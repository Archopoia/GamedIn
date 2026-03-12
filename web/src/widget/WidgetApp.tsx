/**
 * GamedIn embedded widget - full experience on job pages.
 * Stats bar, simulation panel, Profile, Shop, Stats - all accessible.
 */

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { applicationInputSchema, profileSchema } from '../domain/validation'
import {
  applyLoggedCommand,
  createInitialState,
  purchaseUpgrade,
  setDailyRewardCap,
  upsertProfile,
} from '../state/gameState'
import { Arena } from '../game/Arena'
import { generateTestApplication, generateTestApplications } from '../dev/fixtures'
import { loadState, saveState } from './storage'
import type { SaveState } from '../domain/types'
import './WidgetApp.css'

const PENDING_LOGS_KEY = 'gamedin.pendingLogs'
const ACTIVITY_KEY = 'gamedin.activity'
const POLL_MS = 1500

type TabId = 'profile' | 'shop' | 'stats' | 'dev'

const isWidgetDevMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1'

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
  const [profileInput, setProfileInput] = useState({ displayName: '', preferredRoles: '', dailyApplyGoal: '3', cap: '5' })
  const [activity, setActivity] = useState<ActivityEvent[]>([])

  useEffect(() => {
    loadState().then((s) => {
      setState(s)
      setProfileInput({
        displayName: s.profile.displayName,
        preferredRoles: s.profile.preferredRoles.join(', '),
        dailyApplyGoal: s.profile.dailyApplyGoal.toString(),
        cap: s.engagement.dailyRewardCap.toString(),
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
    if (!state || typeof chrome === 'undefined' || !chrome.storage?.local) return

    const processPending = () => {
      try {
        chrome.storage.local.get(PENDING_LOGS_KEY, (result: Record<string, unknown>) => {
          if (chrome?.runtime?.lastError?.message?.includes('Extension context invalidated')) return
          const pending = (result?.[PENDING_LOGS_KEY] as Array<{ title?: string; company?: string; source?: string }>) || []
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
                })
                setMessage('Application logged! Rewards granted.')
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
        })
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
      chrome.storage.local.get(ACTIVITY_KEY, (result: Record<string, unknown>) => {
        if (chrome?.runtime?.lastError?.message?.includes('Extension context invalidated')) return
        const act = (result?.[ACTIVITY_KEY] as ActivityEvent[]) || []
        setActivity(Array.isArray(act) ? act : [])
      })
    } catch {
      /* extension context invalidated */
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'stats') fetchActivity()
  }, [activeTab, fetchActivity])

  const sendResize = useCallback((h: number) => {
    try {
      window.parent?.postMessage?.({ type: 'GAMEDIN_WIDGET_RESIZE', height: h }, '*')
    } catch {
      /* cross-origin */
    }
  }, [])

  useLayoutEffect(() => {
    sendResize(activeTab ? 420 : 180)
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
      preferredRoles: profileInput.preferredRoles.split(',').map((v) => v.trim()).filter(Boolean),
      dailyApplyGoal: Number(profileInput.dailyApplyGoal),
    })
    if (!parsed.success) {
      setMessage('Profile validation failed.')
      return
    }
    setState((c) => (c ? upsertProfile(c, parsed.data) : c))
    setMessage('Profile saved.')
    setTimeout(() => setMessage(null), 2000)
  }

  const handleCapSave = () => {
    if (!state) return
    setState((c) => (c ? setDailyRewardCap(c, Number(profileInput.cap)) : c))
    setMessage('Daily cap updated.')
    setTimeout(() => setMessage(null), 2000)
  }

  const handleUpgradePurchase = () => {
    if (!state) return
    const res = purchaseUpgrade(state)
    if (!res.event) {
      setMessage('Not enough points.')
      return
    }
    setState(res.state)
    setMessage(`Upgrade level ${res.state.upgrades.upgradeLevel}.`)
    setTimeout(() => setMessage(null), 2000)
  }

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
      economy: { points: 500, totalPointsEarned: 500 },
      units: { active: 12, happiestMood: 85 },
      upgrades: { upgradeLevel: 3, upgradeCost: 200 },
      engagement: {
        ...next.engagement,
        streakDays: 7,
        appliesToday: 5,
        dailyRewardCap: 10,
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
        <span>Loading…</span>
      </div>
    )
  }

  const todayProgress = Math.min(
    100,
    Math.round((state.engagement.appliesToday / state.profile.dailyApplyGoal) * 100),
  )
  const counts = {
    search: activity.filter((a) => a.event === 'search').length,
    job_list: activity.filter((a) => a.event === 'job_list').length,
    job_clicked: activity.filter((a) => a.event === 'job_clicked').length,
    job_viewed: activity.filter((a) => a.event === 'job_viewed').length,
  }
  const recent = [...activity].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 4)

  return (
    <div className={`gamedin-widget gamedin-widget-embedded ${activeTab ? 'gamedin-widget-popup-open' : ''}`}>
      <div className="gamedin-widget-inner">
      <div className="gamedin-widget-bar-wrap">
      {activeTab && (
        <div className="gamedin-widget-popup">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSave} className="gamedin-widget-form gamedin-widget-form-inline">
              <h3>Profile</h3>
              <div className="gamedin-widget-form-row">
                <label>Name <input value={profileInput.displayName} onChange={(e) => setProfileInput((c) => ({ ...c, displayName: e.target.value }))} /></label>
                <label>Goal <input type="number" min={1} max={20} value={profileInput.dailyApplyGoal} onChange={(e) => setProfileInput((c) => ({ ...c, dailyApplyGoal: e.target.value }))} /></label>
                <label>Roles <input value={profileInput.preferredRoles} onChange={(e) => setProfileInput((c) => ({ ...c, preferredRoles: e.target.value }))} placeholder="comma" /></label>
                <button type="submit">Save</button>
              </div>
              <div className="gamedin-widget-form-row">
                <label>Cap <input type="number" min={1} max={20} value={profileInput.cap} onChange={(e) => setProfileInput((c) => ({ ...c, cap: e.target.value }))} /></label>
                <button type="button" onClick={handleCapSave}>Save cap</button>
              </div>
            </form>
          )}
          {activeTab === 'shop' && (
            <div className="gamedin-widget-form gamedin-widget-form-inline">
              <h3>Shop</h3>
              <p>Upgrade Lv{state.upgrades.upgradeLevel} · Next: {state.upgrades.upgradeCost} pts</p>
              <button type="button" onClick={handleUpgradePurchase}>Buy upgrade</button>
            </div>
          )}
          {activeTab === 'stats' && (
            <div className="gamedin-widget-form gamedin-widget-form-inline">
              <h3>Stats</h3>
              <p className="gamedin-widget-stat-line">Apps: {state.applications.length}</p>
              <div className="gamedin-widget-activity-counts">
                <span title="Search queries">Searches: {counts.search}</span>
                <span title="Job list views">Job lists: {counts.job_list}</span>
                <span title="Job cards clicked">Jobs clicked: {counts.job_clicked}</span>
                <span title="Job detail views">Jobs viewed: {counts.job_viewed}</span>
              </div>
              {state.applications.length > 0 && (
                <ul className="gamedin-widget-feed gamedin-widget-feed-compact">
                  {[...state.applications].reverse().slice(0, 4).map((app) => (
                    <li key={app.id}><span className="src">{app.source}</span> {app.title} @ {app.company}
                      <span className="time">{formatTime(new Date(app.createdAt).getTime())}</span>
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
                      {ev.title && ` ${ev.title}${ev.company ? ` @ ${ev.company}` : ''}`}
                      <span className="time">{formatTime(ev.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={fetchActivity} className="gamedin-widget-btn-sm">Refresh</button>
            </div>
          )}
          {activeTab === 'dev' && isWidgetDevMode && (
            <div className="gamedin-widget-form gamedin-widget-form-inline">
              <h3>Dev Mode</h3>
              <p className="gamedin-widget-muted">Test features without real applications</p>
              <div className="gamedin-widget-form-row gamedin-widget-dev-actions">
                <button type="button" onClick={handleDevQuickApply}>Quick apply (1)</button>
                <button type="button" onClick={() => handleDevBulkApply(5)}>Bulk apply (5)</button>
                <button type="button" onClick={() => handleDevBulkApply(10)}>Bulk apply (10)</button>
                <button type="button" onClick={handleDevSeedRich}>Seed rich state</button>
                <button type="button" onClick={handleDevReset} className="gamedin-widget-dev-reset">Reset state</button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="gamedin-widget-bar">
        <div className="gamedin-widget-stats">
          <span className="gamedin-widget-brand">GamedIn</span>
          <span title="Points">Pts {state.economy.points}</span>
          <span title="Streak">Streak {state.engagement.streakDays}d</span>
          <span title="Level">Lv {state.progression.level}</span>
          <span title="Entities">Entities {state.units.active}</span>
          <span title="Today">
            {state.engagement.appliesToday}/{state.profile.dailyApplyGoal}
          </span>
        </div>
        <div className="gamedin-widget-tabs">
          {(['profile', 'shop', 'stats', ...(isWidgetDevMode ? ['dev'] : [])] as TabId[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`gamedin-widget-tab ${activeTab === tab ? 'active' : ''}`}
              onMouseDown={onTabMouseDown}
              onClick={() => setActiveTab(activeTab === tab ? null : tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="gamedin-widget-progress-wrap">
          <div className="gamedin-widget-progress" role="progressbar" aria-valuenow={todayProgress}>
            <span style={{ width: `${todayProgress}%` }} />
          </div>
        </div>
        {message && <span className="gamedin-widget-message">{message}</span>}
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
    </div>
  )
}
