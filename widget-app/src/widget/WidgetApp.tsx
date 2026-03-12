/**
 * GamedIn embedded widget - full experience on job pages.
 */

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { applicationInputSchema } from '../domain/validation'
import { tickDecay } from '../state/decay'
import {
  applyLoggedCommand,
  checkDailyReset,
  confirmBonusSpin,
  confirmSpin,
  selectUpgrade,
  upsertProfile,
} from '../state/gameState'
import { getGuiltMessage } from '../domain/guilt'
import { Arena } from './Arena'
import { SpinReveal } from './SpinReveal'
import { UpgradePicker } from './UpgradePicker'
import { WidgetBar } from './WidgetBar'
import { ProfilePanel } from './ProfilePanel'
import { StatsPanel } from './StatsPanel'
import { PageDataPanelWrapper } from './PageDataPanelWrapper'
import { DevPanelWrapper } from './DevPanelWrapper'
import { loadState, saveState } from './storage'
import type { SaveState } from '../domain/types'
import type { PageState } from './PageDataPanel'

const PENDING_LOGS_KEY = 'gamedin.pendingLogs'
const ACTIVITY_KEY = 'gamedin.activity'
const PAGE_STATE_KEY = 'gamedin.pageState'
const POLL_MS = 1500

type TabId = 'profile' | 'stats' | 'pagedata' | 'dev'

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

export function WidgetApp() {
  const [state, setState] = useState<SaveState | null>(null)
  const hasState = state !== null
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
      return (
        typeof localStorage !== 'undefined' &&
        localStorage.getItem('gamedin.onboardingSeen') === '1'
      )
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
  }, [hasState])

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
      chrome.storage.local.get(
        PAGE_STATE_KEY,
        (result: Record<string, unknown>) => {
          const ps = result?.[PAGE_STATE_KEY] as PageState | null
          setState((s) => {
            if (!s) return s
            const withReset = checkDailyReset(s)
            return tickDecay(withReset, ps, DECAY_INTERVAL_MS)
          })
        },
      )
    }, DECAY_INTERVAL_MS)
    return () => clearInterval(id)
  }, [hasState])

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

  const handleSpinConfirm = useCallback(() => {
    setState((s) => (s ? confirmSpin(s) : s))
  }, [])

  const handleBonusSpinConfirm = useCallback(() => {
    setState((s) => (s ? confirmBonusSpin(s) : s))
  }, [])

  const handleUpgradeSelect = useCallback((id: string) => {
    setState((s) => (s ? selectUpgrade(s, id) : s))
  }, [])

  if (!state) {
    return (
      <div className="gd-shell flex w-full min-h-[180px] items-center justify-center border-t-2 border-gamedin-accent px-4">
        <div className="gd-panel flex items-center gap-2 px-4 py-3 text-gamedin-muted">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-gamedin-accent" />
          <span>Loading your despair...</span>
        </div>
      </div>
    )
  }

  const BAR_ARENA_HEIGHT = 180
  const containerHeight = activeTab
    ? BAR_ARENA_HEIGHT + (popupHeight || 250)
    : BAR_ARENA_HEIGHT

  return (
    <div
      className="gd-shell"
      style={{ minHeight: BAR_ARENA_HEIGHT, height: containerHeight }}
    >
      {activeTab && (
        <div
          ref={popupRef}
          className="gd-panel gd-scroll absolute left-0 z-[1000] w-[280px] max-w-[280px] max-h-[520px] overflow-y-auto rounded-t-xl border-b-0 p-3.5"
          style={{ bottom: BAR_ARENA_HEIGHT }}
        >
          {activeTab === 'profile' && (
            <ProfilePanel
              profileInput={profileInput}
              setProfileInput={setProfileInput}
              setState={setState}
              setMessage={setMessage}
              onboardingSeen={onboardingSeen}
              dismissOnboarding={dismissOnboarding}
              upsertProfile={upsertProfile}
            />
          )}
          {activeTab === 'pagedata' && (
            <PageDataPanelWrapper
              pageState={pageState}
              onRefresh={fetchActivity}
            />
          )}
          {activeTab === 'stats' && (
            <StatsPanel
              state={state}
              activity={activity}
              onRefresh={fetchActivity}
            />
          )}
          {activeTab === 'dev' && isWidgetDevMode && (
            <DevPanelWrapper
              state={state}
              setState={setState}
              setMessage={setMessage}
              persist={persist}
            />
          )}
        </div>
      )}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col border-t-2 border-gamedin-accent pointer-events-auto"
        style={{
          height: BAR_ARENA_HEIGHT,
          background:
            'linear-gradient(180deg, rgba(53,39,31,0.92) 0%, rgba(31,23,18,0.98) 100%)',
        }}
      >
        <WidgetBar
          state={state}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          message={message}
          isWidgetDevMode={isWidgetDevMode}
          onTabMouseDown={onTabMouseDown}
        />
        <div className="relative flex-1 min-h-[140px] w-full overflow-hidden">
          <Arena
            state={state}
            setState={setState as React.Dispatch<React.SetStateAction<SaveState>>}
          />
        </div>
      </div>
      {state.pendingSpin && (
        <SpinReveal result={state.pendingSpin} onConfirm={handleSpinConfirm} />
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
