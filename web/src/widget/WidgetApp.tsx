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
import './WidgetApp.css'

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
    const id = setInterval(fetchActivity, 5000)
    return () => clearInterval(id)
  }, [fetchActivity])

  useEffect(() => {
    if (activeTab !== 'pagedata') return
    const id = setInterval(fetchActivity, 1000)
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
      setPopupHeight(0)
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
      <div className="gamedin-widget gamedin-widget-loading">
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
      className={`gamedin-widget gamedin-widget-embedded ${activeTab ? 'gamedin-widget-popup-open' : ''}`}
      style={activeTab && popupHeight > 0 ? { paddingTop: popupHeight } : undefined}
    >
      <div className="gamedin-widget-inner">
        <div className="gamedin-widget-bar-wrap">
          {activeTab && (
            <div ref={popupRef} className="gamedin-widget-popup">
              {activeTab === 'profile' && (
                <form
                  onSubmit={handleProfileSave}
                  className="gamedin-widget-form gamedin-widget-form-inline"
                >
                  <h3>Hopium Config</h3>
                  {!onboardingSeen && (
                    <div className="gamedin-widget-onboarding">
                      <p className="gamedin-widget-onboarding-title">How it works</p>
                      <ul className="gamedin-widget-onboarding-list">
                        <li><strong>Hopium</strong> — Currency earned when you apply. Decays when idle.</li>
                        <li><strong>Run</strong> — Daily goal (X/Y). Hit it to complete your run.</li>
                        <li><strong>Cope Pet</strong> — Mood reflects apply activity. Apply to feed it.</li>
                        <li><strong>Apply</strong> on LinkedIn, Indeed, Glassdoor — extension detects it and grants rewards.</li>
                      </ul>
                      <button type="button" className="gamedin-widget-onboarding-dismiss" onClick={dismissOnboarding}>
                        Got it
                      </button>
                    </div>
                  )}
                  <div className="gamedin-widget-form-row">
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
                <div className="gamedin-widget-form gamedin-widget-form-inline">
                  <PageDataPanel pageState={pageState} onRefresh={fetchActivity} />
                </div>
              )}
              {activeTab === 'stats' && (
                <div className="gamedin-widget-form gamedin-widget-form-inline">
                  <h3>Rejection Ledger</h3>
                  <p className="gamedin-widget-stat-line">
                    Apps: {state.applications.length}
                  </p>
                  <p className="gamedin-widget-stat-line">
                    Achievements: {state.meta.achievements.length}
                  </p>
                  {state.applications.length === 0 && (
                    <p className="gamedin-widget-empty-state">
                      Apply to jobs on LinkedIn, Indeed, or Glassdoor to see your first entry. The extension detects applies automatically.
                    </p>
                  )}
                  {state.meta.collectibles.length > 0 && (
                    <div className="gamedin-widget-collectibles">
                      <span className="gamedin-widget-collectibles-label">Unlocked:</span>
                      {state.meta.collectibles.map((id) => (
                        <span key={id} className="gamedin-widget-collectible" title={id}>
                          {ACHIEVEMENT_LABELS[id] ?? id}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="gamedin-widget-activity-counts">
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
                    <ul className="gamedin-widget-feed gamedin-widget-feed-compact">
                      {[...state.applications]
                        .reverse()
                        .slice(0, 4)
                        .map((app) => (
                          <li key={app.id}>
                            <span className="src">{app.source}</span> {app.title}{' '}
                            @ {app.company}
                            <span className="time">
                              {formatTime(new Date(app.createdAt).getTime())}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                  {recent.length > 0 && (
                    <ul className="gamedin-widget-feed gamedin-widget-feed-compact">
                      {recent.map((ev, i) => (
                        <li key={i}>
                          <span className="src">{ev.event}</span>
                          {ev.keywords && ` "${ev.keywords}"`}
                          {ev.title &&
                            ` ${ev.title}${ev.company ? ` @ ${ev.company}` : ''}`}
                          <span className="time">
                            {formatTime(ev.timestamp)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={fetchActivity}
                    className="gamedin-widget-btn-sm"
                  >
                    Refresh the Pain
                  </button>
                </div>
              )}
              {activeTab === 'dev' && isWidgetDevMode && (
                <div className="gamedin-widget-form gamedin-widget-form-inline">
                  <h3>Dev Mode</h3>
                  <p className="gamedin-widget-muted">
                    Test features without real applications
                  </p>
                  <div className="gamedin-widget-form-row gamedin-widget-dev-actions">
                    <button type="button" onClick={handleDevQuickApply}>
                      Quick apply (1)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDevBulkApply(5)}
                    >
                      Bulk apply (5)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDevBulkApply(10)}
                    >
                      Bulk apply (10)
                    </button>
                    <button type="button" onClick={handleDevSeedRich}>
                      Seed rich state
                    </button>
                    <button
                      type="button"
                      onClick={handleDevReset}
                      className="gamedin-widget-dev-reset"
                    >
                      Reset state
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="gamedin-widget-bar">
            <div className="gamedin-widget-stats">
              <span className="gamedin-widget-brand">GamedIn</span>
              <span title="Currency earned by applying">Hopium: {state.economy.hopium}</span>
              <span title="Consecutive days hitting daily goal">Streak: {state.engagement.streakDays}d</span>
              <span title="Daily apply goal (X/Y)">
                Run: {state.run.appliesToday}/{state.profile.dailyApplyGoal}
              </span>
            </div>
            <div className="gamedin-widget-tabs">
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
                  className={`gamedin-widget-tab ${activeTab === tab ? 'active' : ''}`}
                  onMouseDown={onTabMouseDown}
                  onClick={() =>
                    setActiveTab(activeTab === tab ? null : tab)
                  }
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
            <div className="gamedin-widget-progress-wrap">
              <div
                className="gamedin-widget-progress"
                role="progressbar"
                aria-valuenow={todayProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Daily run progress: ${todayProgress}%`}
              >
                <span style={{ width: `${todayProgress}%` }} />
              </div>
            </div>
            {message && (
              <span className="gamedin-widget-message">{message}</span>
            )}
          </div>
        </div>
        <div className="gamedin-widget-arena-wrap">
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
