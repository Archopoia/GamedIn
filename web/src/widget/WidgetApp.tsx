/**
 * GamedIn embedded widget - full experience on job pages.
 */

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { applicationInputSchema, profileSchema } from '../domain/validation'
import { tickDecay } from '../state/decay'
import {
  applyLoggedCommand,
  checkDailyReset,
  confirmBonusSpin,
  confirmSpin,
  createInitialState,
  selectUpgrade,
  upsertProfile,
} from '../state/gameState'
import { ACHIEVEMENT_LABELS } from '../domain/achievements'
import { getGuiltMessage } from '../domain/guilt'
import { Arena } from '../game/Arena'
import { SpinReveal } from '../game/SpinReveal'
import { UpgradePicker } from '../game/UpgradePicker'
import { PageDataPanel, type PageState } from '../game/PageDataPanel'
import { generateTestApplication, generateTestApplications } from '../dev/fixtures'
import { loadState, saveState } from './storage'
import type { SaveState } from '../domain/types'

const PENDING_LOGS_KEY = 'gamedin.pendingLogs'
const ACTIVITY_KEY = 'gamedin.activity'
const PAGE_STATE_KEY = 'gamedin.pageState'
const POLL_MS = 1500

type TabId = 'profile' | 'stats' | 'pagedata' | 'dev'

const TAB_LABELS: Record<TabId, string> = {
  profile: 'Hopium Config',
  stats: 'Rejection Ledger',
  pagedata: 'Page Data',
  dev: 'Dev',
}

const isWidgetDevMode =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('dev') === '1'

interface ActivityEvent {
  event: string
  site?: string
  timestamp?: number
  keywords?: string
  jobId?: string
  title?: string
  company?: string
  count?: number
}

function formatTime(ts?: number) {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return d.toLocaleDateString()
}

export function WidgetApp() {
  const [state, setState] = useState<SaveState | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId | null>(null)
  const [profileInput, setProfileInput] = useState({
    displayName: '',
    preferredRoles: '',
    dailyApplyGoal: '3',
  })
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [pageState, setPageState] = useState<PageState | null>(null)
  const [onboardingSeen, setOnboardingSeen] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('gamedin.onboardingSeen') === '1'
    } catch {
      return false
    }
  })
  const lastGuiltAtRef = React.useRef(0)

  const dismissOnboarding = useCallback(() => {
    try {
      localStorage.setItem('gamedin.onboardingSeen', '1')
      setOnboardingSeen(true)
    } catch {
      setOnboardingSeen(true)
    }
  }, [])

  useEffect(() => {
    loadState().then((s) => {
      setState(s)
      setProfileInput({
        displayName: s.profile.displayName,
        preferredRoles: s.profile.preferredRoles.join(', '),
        dailyApplyGoal: s.profile.dailyApplyGoal.toString(),
      })
    })
  }, [])

  const persist = useCallback((s: SaveState) => {
    saveState(s)
  }, [])

  useEffect(() => {
    if (!state) return
    persist(state)
  }, [state, persist])

  useEffect(() => {
    if (!state || typeof chrome === 'undefined' || !chrome.storage?.local)
      return

    const processPending = () => {
      try {
        chrome.storage.local.get(
          [PENDING_LOGS_KEY, PAGE_STATE_KEY],
          (result: Record<string, unknown>) => {
            if (
              chrome?.runtime?.lastError?.message?.includes(
                'Extension context invalidated',
              )
            )
              return
            const pending = (result?.[PENDING_LOGS_KEY] as Array<{
              title?: string
              company?: string
              source?: string
            }>) || []
            const ps = result?.[PAGE_STATE_KEY] as PageState | null
            if (!Array.isArray(pending) || pending.length === 0) return

            for (const log of pending) {
              const parsed = applicationInputSchema.safeParse({
                title: log.title?.trim() || 'Unknown Role',
                company: log.company?.trim() || 'Unknown Company',
                source: log.source || 'linkedin',
                qualityScore: 3,
              })
              if (parsed.success) {
                setState((prev) => {
                  if (!prev) return prev
                  const res = applyLoggedCommand(prev, {
                    ...parsed.data,
                    qualityScore: 3 as 1 | 2 | 3 | 4 | 5,
                  }, ps)
                  const hopium = res.state.pendingSpin?.hopiumAwarded ?? 0
                  setMessage(
                    `Application logged. +${hopium} Hopium. They probably won't reply.`,
                  )
                  setTimeout(() => setMessage(null), 3000)
                  return res.state
                })
              }
            }
            try {
              chrome.storage.local.set({ [PENDING_LOGS_KEY]: [] })
            } catch {
              /* extension context invalidated */
            }
          },
        )
      } catch {
        /* extension context invalidated */
      }
    }

    processPending()
    const id = setInterval(processPending, POLL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gate on state loaded, not on every state change
  }, [state !== null])

  const fetchActivity = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return
    try {
      chrome.storage.local.get(
        [ACTIVITY_KEY, PAGE_STATE_KEY],
        (result: Record<string, unknown>) => {
          if (
            chrome?.runtime?.lastError?.message?.includes(
              'Extension context invalidated',
            )
          )
            return
          const act = (result?.[ACTIVITY_KEY] as ActivityEvent[]) || []
          setActivity(Array.isArray(act) ? act : [])
          setPageState((result?.[PAGE_STATE_KEY] as PageState) ?? null)
        },
      )
    } catch {
      /* extension context invalidated */
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'stats' || activeTab === 'pagedata') fetchActivity()
  }, [activeTab, fetchActivity])

  useEffect(() => {
    const intervalMs = activeTab === 'pagedata' ? 1000 : 5000
    const id = setInterval(fetchActivity, intervalMs)
    return () => clearInterval(id)
  }, [activeTab, fetchActivity])

  useEffect(() => {
    if (!state || state.pendingSpin || state.pendingUpgradeOptions) return
    const runState = {
      appliesToday: state.run.appliesToday,
      dailyApplyGoal: state.profile.dailyApplyGoal,
    }
    const sessionState = pageState ? { tabVisible: pageState.tabVisible } : null
    const guilt = getGuiltMessage(
      pageState,
      lastGuiltAtRef.current,
      runState,
      sessionState,
    )
    if (guilt) {
      lastGuiltAtRef.current = guilt.at
      setMessage(guilt.message)
      setTimeout(() => setMessage(null), 5000)
    }
  }, [state, pageState])

  useEffect(() => {
    if (!state || typeof chrome === 'undefined' || !chrome.storage?.local)
      return
    const DECAY_INTERVAL_MS = 60_000
    const id = setInterval(() => {
      chrome.storage.local.get(PAGE_STATE_KEY, (result: Record<string, unknown>) => {
        const ps = result?.[PAGE_STATE_KEY] as PageState | null
        setState((s) => {
          if (!s) return s
          const withReset = checkDailyReset(s)
          return tickDecay(withReset, ps, DECAY_INTERVAL_MS)
        })
      })
    }, DECAY_INTERVAL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gate on state loaded, not on every state change
  }, [state !== null])

  const sendResize = useCallback((h: number) => {
    try {
      window.parent?.postMessage?.(
        { type: 'GAMEDIN_WIDGET_RESIZE', height: h },
        '*',
      )
    } catch {
      /* cross-origin */
    }
  }, [])

  const popupRef = React.useRef<HTMLDivElement | null>(null)
  const [popupHeight, setPopupHeight] = useState(0)

  useLayoutEffect(() => {
    if (!activeTab) {
      sendResize(180)
      return
    }
    const popup = popupRef.current
    if (!popup) {
      sendResize(420)
      return
    }
    const measure = () => {
      const h = popup.scrollHeight
      const clamped = Math.min(Math.max(h, 120), 520)
      setPopupHeight(clamped)
      sendResize(clamped + 180)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(popup)
    return () => ro.disconnect()
  }, [activeTab, sendResize])

  const onTabMouseDown = useCallback(() => {
    if (!activeTab) sendResize(420)
  }, [activeTab, sendResize])

  const handleProfileSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const s = state
    if (!s) return
    const parsed = profileSchema.safeParse({
      displayName: profileInput.displayName,
      preferredRoles: profileInput.preferredRoles
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      dailyApplyGoal: Number(profileInput.dailyApplyGoal),
    })
    if (!parsed.success) {
      setMessage('Profile validation failed.')
      return
    }
    setState((c) => (c ? upsertProfile(c, parsed.data) : c))
    setMessage('Delusion saved.')
    setTimeout(() => setMessage(null), 2000)
  }

  const handleSpinConfirm = useCallback(() => {
    setState((s) => (s ? confirmSpin(s) : s))
  }, [])

  const handleBonusSpinConfirm = useCallback(() => {
    setState((s) => (s ? confirmBonusSpin(s) : s))
  }, [])

  const handleUpgradeSelect = useCallback((id: string) => {
    setState((s) => (s ? selectUpgrade(s, id) : s))
  }, [])

  const handleDevQuickApply = () => {
    if (!state) return
    const input = generateTestApplication()
    const res = applyLoggedCommand(state, input)
    setState(res.state)
    setMessage(`Dev: Added 1 test application (${input.title} @ ${input.company})`)
    setTimeout(() => setMessage(null), 3000)
  }

  const handleDevBulkApply = (count: number) => {
    if (!state) return
    const inputs = generateTestApplications(count)
    let next = state
    for (const input of inputs) {
      const res = applyLoggedCommand(next, input)
      next = res.state
    }
    setState(next)
    setMessage(`Dev: Added ${count} test applications`)
    setTimeout(() => setMessage(null), 3000)
  }

  const handleDevSeedRich = () => {
    if (!state) return
    const inputs = generateTestApplications(15)
    let next = state
    for (const input of inputs) {
      const res = applyLoggedCommand(next, input)
      next = res.state
    }
    next = {
      ...next,
      economy: { hopium: 500, totalHopiumEarned: 500 },
      engagement: { ...next.engagement, streakDays: 7 },
      run: {
        ...next.run,
        appliesToday: 5,
        completed: true,
      },
    }
    setState(next)
    persist(next)
    setMessage('Dev: Seeded rich state')
    setTimeout(() => setMessage(null), 3000)
  }

  const handleDevReset = () => {
    const fresh = createInitialState()
    setState(fresh)
    persist(fresh)
    setMessage('Dev: Reset to initial state')
    setTimeout(() => setMessage(null), 3000)
  }

  if (!state) {
    return (
      <div className="flex flex-col w-full h-full min-h-[180px] items-center justify-center text-gamedin-muted bg-gradient-to-t from-gamedin-bg-gradient to-gamedin-bg border-t-2 border-gamedin-success">
        <span>Loading your despair…</span>
      </div>
    )
  }

  const todayProgress = Math.min(
    100,
    Math.round(
      (state.run.appliesToday / state.profile.dailyApplyGoal) * 100,
    ),
  )
  const counts = {
    search: activity.filter((a) => a.event === 'search').length,
    job_list: activity.filter((a) => a.event === 'job_list').length,
    job_clicked: activity.filter((a) => a.event === 'job_clicked').length,
    job_viewed: activity.filter((a) => a.event === 'job_viewed').length,
  }
  const recent = [...activity]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 4)

  return (
    <div
      className="flex flex-col w-full h-full min-h-[180px] text-[13px] font-sans p-0"
      style={activeTab ? { paddingTop: popupHeight || 250 } : undefined}
    >
      <div className="flex-1 flex flex-col min-h-[180px] bg-gradient-to-t from-gamedin-bg-gradient to-gamedin-bg border-t-2 border-gamedin-success pointer-events-auto">
        <div className="relative shrink-0">
          {activeTab && (
            <div
              ref={popupRef}
              className="absolute bottom-full left-0 w-[280px] max-w-[280px] max-h-[520px] overflow-y-auto p-3 px-4 bg-gamedin-bg border border-b-0 border-gamedin-border rounded-t-lg shadow-[0_-4px_12px_rgba(0,0,0,0.3)] z-[1000]"
            >
              {activeTab === 'profile' && (
                <form onSubmit={handleProfileSave} className="[&_h3]:m-0 [&_h3]:mb-1.5 [&_h3]:text-[13px] [&_h3]:text-gamedin-accent [&_p]:m-0 [&_p]:mb-1 [&_label]:m-0 [&_label]:mb-1 [&_label]:text-xs [&_label]:text-gamedin-text [&_input]:ml-1 [&_input]:py-0.5 [&_input]:px-1.5 [&_input]:text-[11px] [&_input]:bg-gamedin-panel [&_input]:border [&_input]:border-gamedin-border [&_input]:rounded [&_input]:text-gamedin-text-bright [&_button]:m-1 [&_button]:mr-1 [&_button]:mt-1 [&_button]:mb-1 [&_button]:py-1 [&_button]:px-2 [&_button]:text-[11px] [&_button]:bg-gamedin-success [&_button]:border [&_button]:border-gamedin-border [&_button]:rounded [&_button]:text-gamedin-text-bright [&_button]:cursor-pointer">
                  <h3>Hopium Config</h3>
                  {!onboardingSeen && (
                    <div className="mb-3 p-2.5 px-3 bg-gamedin-panel border border-gamedin-border rounded">
                      <p className="m-0 mb-1.5 text-xs font-bold text-gamedin-accent">How it works</p>
                      <ul className="m-0 mb-2 pl-[18px] text-[11px] text-gamedin-text leading-relaxed [&_li]:mb-1">
                        <li><strong>Hopium</strong> — Currency earned when you apply. Decays when idle.</li>
                        <li><strong>Run</strong> — Daily goal (X/Y). Hit it to complete your run.</li>
                        <li><strong>Cope Pet</strong> — Mood reflects apply activity. Apply to feed it.</li>
                        <li><strong>Apply</strong> on LinkedIn, Indeed, Glassdoor — extension detects it and grants rewards.</li>
                      </ul>
                      <button type="button" className="py-1 px-2.5 text-[11px] bg-gamedin-border border border-gamedin-accent rounded text-gamedin-accent cursor-pointer hover:bg-gamedin-hover" onClick={dismissOnboarding}>
                        Got it
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <label>
                      Name{' '}
                      <input
                        value={profileInput.displayName}
                        onChange={(e) =>
                          setProfileInput((c) => ({
                            ...c,
                            displayName: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Daily Hopium Dose{' '}
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={profileInput.dailyApplyGoal}
                        onChange={(e) =>
                          setProfileInput((c) => ({
                            ...c,
                            dailyApplyGoal: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Roles{' '}
                      <input
                        value={profileInput.preferredRoles}
                        onChange={(e) =>
                          setProfileInput((c) => ({
                            ...c,
                            preferredRoles: e.target.value,
                          }))
                        }
                        placeholder="Preferred roles (comma-separated)"
                      />
                    </label>
                    <button type="submit">Commit to Delusion</button>
                  </div>
                </form>
              )}
              {activeTab === 'pagedata' && (
                <div className="[&_h2]:m-0 [&_h2]:mb-1.5 [&_h3]:m-0 [&_h3]:mb-1.5 [&_h2]:text-[13px] [&_h3]:text-[13px] [&_h2]:text-gamedin-accent [&_h3]:text-gamedin-accent">
                  <PageDataPanel pageState={pageState} onRefresh={fetchActivity} />
                </div>
              )}
              {activeTab === 'stats' && (
                <div className="[&_h3]:m-0 [&_h3]:mb-1.5 [&_h3]:text-[13px] [&_h3]:text-gamedin-accent [&_p]:m-0 [&_p]:mb-1 [&_p]:text-xs [&_p]:text-gamedin-text">
                  <h3>Rejection Ledger</h3>
                  <p className="mb-1">
                    Apps: {state.applications.length}
                  </p>
                  <p className="mb-1">
                    Achievements: {state.meta.achievements.length}
                  </p>
                  {state.applications.length === 0 && (
                    <p className="text-gamedin-muted text-xs my-2 py-2 border-t border-gamedin-border">
                      Apply to jobs on LinkedIn, Indeed, or Glassdoor to see your first entry. The extension detects applies automatically.
                    </p>
                  )}
                  {state.meta.collectibles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 gap-x-2.5 mt-2">
                      <span className="text-gamedin-muted text-xs">Unlocked:</span>
                      {state.meta.collectibles.map((id) => (
                        <span key={id} className="py-0.5 px-2 bg-gamedin-border rounded text-xs text-gamedin-accent" title={id}>
                          {ACHIEVEMENT_LABELS[id] ?? id}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-2 mb-1.5 text-xs text-gamedin-text [&_span]:whitespace-nowrap">
                    <span title="Search queries">Searches: {counts.search}</span>
                    <span title="Job list views">Job lists: {counts.job_list}</span>
                    <span title="Job cards clicked">
                      Jobs clicked: {counts.job_clicked}
                    </span>
                    <span title="Job detail views">
                      Jobs viewed: {counts.job_viewed}
                    </span>
                  </div>
                  {state.applications.length > 0 && (
                    <ul className="list-none p-0 my-1 text-xs text-gamedin-text [&_li]:py-0.5 [&_li]:border-b [&_li]:border-gamedin-border">
                      {[...state.applications]
                        .reverse()
                        .slice(0, 4)
                        .map((app) => (
                          <li key={app.id}>
                            <span className="text-gamedin-accent mr-1">{app.source}</span> {app.title}{' '}
                            @ {app.company}
                            <span className="float-right text-gamedin-muted text-[11px]">
                              {formatTime(new Date(app.createdAt).getTime())}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                  {recent.length > 0 && (
                    <ul className="list-none p-0 my-1 text-xs text-gamedin-text [&_li]:py-0.5 [&_li]:border-b [&_li]:border-gamedin-border">
                      {recent.map((ev, i) => (
                        <li key={i}>
                          <span className="text-gamedin-accent mr-1">{ev.event}</span>
                          {ev.keywords && ` "${ev.keywords}"`}
                          {ev.title &&
                            ` ${ev.title}${ev.company ? ` @ ${ev.company}` : ''}`}
                          <span className="float-right text-gamedin-muted text-[11px]">
                            {formatTime(ev.timestamp)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={fetchActivity}
                    className="mt-1 py-1 px-2 text-[11px] bg-gamedin-success border border-gamedin-border rounded text-gamedin-text-bright cursor-pointer"
                  >
                    Refresh the Pain
                  </button>
                </div>
              )}
              {activeTab === 'dev' && isWidgetDevMode && (
                <div className="[&_h3]:m-0 [&_h3]:mb-1.5 [&_h3]:text-[13px] [&_h3]:text-gamedin-accent [&_p]:m-0 [&_p]:mb-1 [&_p]:text-xs [&_p]:text-gamedin-muted [&_button]:m-0 [&_button]:py-1 [&_button]:px-2 [&_button]:text-[11px] [&_button]:bg-gamedin-success [&_button]:border [&_button]:border-gamedin-border [&_button]:rounded [&_button]:text-gamedin-text-bright [&_button]:cursor-pointer">
                  <h3>Dev Mode</h3>
                  <p className="text-gamedin-muted text-xs m-0">
                    Test features without real applications
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={handleDevQuickApply}>
                      Quick apply (1)
                    </button>
                    <button type="button" onClick={() => handleDevBulkApply(5)}>
                      Bulk apply (5)
                    </button>
                    <button type="button" onClick={() => handleDevBulkApply(10)}>
                      Bulk apply (10)
                    </button>
                    <button type="button" onClick={handleDevSeedRich}>
                      Seed rich state
                    </button>
                    <button
                      type="button"
                      onClick={handleDevReset}
                      className="text-gamedin-danger border-gamedin-danger-border"
                    >
                      Reset state
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="shrink-0 flex items-center gap-3 py-1.5 px-3 bg-gamedin-bg border-b border-gamedin-border">
            <div className="flex flex-wrap items-center gap-2.5 text-gamedin-text">
              <span className="font-bold text-gamedin-accent mr-1">GamedIn</span>
              <span title="Currency earned by applying">Hopium: {state.economy.hopium}</span>
              <span title="Consecutive days hitting daily goal">Streak: {state.engagement.streakDays}d</span>
              <span title="Daily apply goal (X/Y)">
                Run: {state.run.appliesToday}/{state.profile.dailyApplyGoal}
              </span>
            </div>
            <div className="flex gap-1">
              {(
                [
                  'profile',
                  'stats',
                  'pagedata',
                  ...(isWidgetDevMode ? ['dev'] : []),
                ] as TabId[]
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`py-1 px-2 text-[11px] bg-transparent border border-gamedin-border rounded text-gamedin-muted cursor-pointer hover:bg-gamedin-panel hover:text-gamedin-accent ${activeTab === tab ? 'bg-gamedin-panel text-gamedin-accent' : ''}`}
                  onMouseDown={onTabMouseDown}
                  onClick={() =>
                    setActiveTab(activeTab === tab ? null : tab)
                  }
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-[80px] max-w-[120px]">
              <div
                className="h-1 bg-gamedin-panel rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={todayProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Daily run progress: ${todayProgress}%`}
              >
                <span className="block h-full bg-gamedin-accent transition-[width] duration-200" style={{ width: `${todayProgress}%` }} />
              </div>
            </div>
            {message && (
              <span className="text-[11px] text-gamedin-text">{message}</span>
            )}
          </div>
        </div>
        <div className="relative flex-1 min-h-[140px] w-full overflow-hidden">
          <Arena
            state={state}
            setState={setState as React.Dispatch<React.SetStateAction<SaveState>>}
            setMessage={setMessage}
          />
        </div>
      </div>

      {state.pendingSpin && (
        <SpinReveal
          result={state.pendingSpin}
          onConfirm={handleSpinConfirm}
        />
      )}
      {!state.pendingSpin &&
        state.pendingUpgradeOptions &&
        state.pendingUpgradeOptions.length > 0 && (
          <UpgradePicker
            options={state.pendingUpgradeOptions}
            onSelect={handleUpgradeSelect}
          />
        )}
      {!state.pendingSpin &&
        !state.pendingUpgradeOptions?.length &&
        state.pendingBonusSpin && (
          <SpinReveal
            result={state.pendingBonusSpin}
            onConfirm={handleBonusSpinConfirm}
            title="Run complete! Bonus spin."
          />
        )}
    </div>
  )
}
