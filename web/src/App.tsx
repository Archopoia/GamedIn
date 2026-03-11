import { type FormEvent, useEffect, useMemo, useState } from 'react'
import './App.css'
import { compliancePolicy } from './compliance/policy'
import { DevPanel } from './dev/DevPanel'
import { isDevMode } from './lib/devMode'
import { toTelemetryEvent } from './domain/events'
import { applicationInputSchema, profileSchema } from './domain/validation'
import { Pasture } from './game/Pasture'
import { StatsPanel } from './game/StatsPanel'
import { initAnalytics, trackEvent } from './lib/analytics'
import {
  applyLoggedCommand,
  createInitialState,
  purchaseBathUpgrade,
  setDailyRewardCap,
  upsertProfile,
} from './state/gameState'
import { loadState, saveState } from './state/saveSync'

type TabId = 'extension' | 'stats' | 'profile' | 'shop' | 'dev'

interface ActivityEvent {
  event: string
  timestamp?: number
  keywords?: string
  jobId?: string
  title?: string
  company?: string
  count?: number
  jobs?: Array<{ jobId: string; title: string; company: string }>
}

function App() {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') {
      return createInitialState()
    }
    return loadState()
  })
  const [activeTab, setActiveTab] = useState<TabId>('extension')
  const [profileInput, setProfileInput] = useState({
    displayName: state.profile.displayName,
    preferredRoles: state.profile.preferredRoles.join(', '),
    dailyApplyGoal: state.profile.dailyApplyGoal.toString(),
  })
  const [message, setMessage] = useState('Welcome to your cozy application loop.')
  const [capInput, setCapInput] = useState(state.engagement.dailyRewardCap.toString())
  const [activity, setActivity] = useState<ActivityEvent[]>([])

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[GamedIn App] Dispatching gamedin-extension-ready')
      window.dispatchEvent(new CustomEvent('gamedin-extension-ready'))
    }
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ title: string; company: string; source: string }>
      const { title, company, source } = ev.detail || {}
      console.log('[GamedIn App] Received gamedin-apply-logged', { title, company, source })
      const parsed = applicationInputSchema.safeParse({
        title: title?.trim() || 'Unknown Role',
        company: company?.trim() || 'Unknown Company',
        source: source || 'linkedin',
        qualityScore: 3,
      })
      if (!parsed.success) {
        console.log('[GamedIn App] Validation failed', parsed.error?.issues)
        return
      }
      console.log('[GamedIn App] Applying reward for', parsed.data)
      setState((current) => {
        const result = applyLoggedCommand(current, {
          ...parsed.data,
          qualityScore: 3 as 1 | 2 | 3 | 4 | 5,
        })
        const telemetry = result.events.map((domainEvent) =>
          toTelemetryEvent(domainEvent, result.state),
        )
        return {
          ...result.state,
          telemetryQueue: [...result.state.telemetryQueue, ...telemetry].slice(-100),
        }
      })
      setMessage('Application logged from LinkedIn! Rewards granted.')
      console.log('[GamedIn App] Reward applied successfully')
    }
    window.addEventListener('gamedin-apply-logged', handler)
    return () => window.removeEventListener('gamedin-apply-logged', handler)
  }, [])

  useEffect(() => {
    saveState(state)
    state.telemetryQueue.forEach((event) => trackEvent(event))
  }, [state])

  const fetchActivity = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gamedin-get-activity'))
    }
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ activity: ActivityEvent[] }>
      setActivity(ev.detail?.activity || [])
    }
    window.addEventListener('gamedin-activity', handler)
    return () => window.removeEventListener('gamedin-activity', handler)
  }, [])

  useEffect(() => {
    if (activeTab === 'stats') fetchActivity()
  }, [activeTab])

  const todayProgress = useMemo(() => {
    const ratio = Math.min(1, state.engagement.appliesToday / state.profile.dailyApplyGoal)
    return Math.round(ratio * 100)
  }, [state.engagement.appliesToday, state.profile.dailyApplyGoal])

  const handleProfileSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = profileSchema.safeParse({
      displayName: profileInput.displayName,
      preferredRoles: profileInput.preferredRoles
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      dailyApplyGoal: Number(profileInput.dailyApplyGoal),
    })
    if (!parsed.success) {
      setMessage('Profile validation failed. Check name, roles, and daily goal.')
      return
    }

    setState((current) => upsertProfile(current, parsed.data))
    setMessage(`Profile saved. Daily goal set to ${parsed.data.dailyApplyGoal}.`)
  }

  const handleUpgradePurchase = () => {
    setState((current) => {
      const result = purchaseBathUpgrade(current)
      if (!result.event) {
        setMessage('Not enough Zen for a bath upgrade yet.')
        return current
      }
      const telemetry = toTelemetryEvent(result.event, result.state)
      setMessage(`Bath upgraded to level ${result.state.upgrades.bathLevel}.`)
      return {
        ...result.state,
        telemetryQueue: [...result.state.telemetryQueue, telemetry].slice(-100),
      }
    })
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'extension', label: 'Extension' },
    { id: 'stats', label: 'Stats' },
    { id: 'profile', label: 'Profile' },
    { id: 'shop', label: 'Shop' },
    ...(isDevMode ? [{ id: 'dev' as TabId, label: 'Dev' }] : []),
  ]

  return (
    <main className="app-shell" suppressHydrationWarning>
      <header className="app-header">
        <div className="header-left">
          <h1>GamedIn</h1>
          <span className="dev-badge">{isDevMode && '[Dev]'}</span>
        </div>
        <div className="header-metrics">
          <span title="Zen currency">Zen {state.economy.zen}</span>
          <span title="Active guests">Guests {state.guests.active}</span>
          <span title="Level">Lv {state.progression.level}</span>
          <span title="Streak">Streak {state.engagement.streakDays}d</span>
        </div>
        <div className="header-status" title={compliancePolicy.statement}>
          {message}
        </div>
      </header>

      <div className="app-body">
        <section className="content-area">
          <div className="daily-progress-bar">
            <span>Today: {state.engagement.appliesToday}/{state.profile.dailyApplyGoal}</span>
            <div className="progress-track" role="progressbar" aria-valuenow={todayProgress}>
              <span style={{ width: `${todayProgress}%` }} />
            </div>
          </div>
          <nav className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? 'tab active' : 'tab'}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="tab-content">
            {activeTab === 'extension' && (
              <div className="panel">
                <h2>Extension</h2>
                <p className="apply-hint">
                  Install the GamedIn Chrome extension for full automation. When you Easy Apply on LinkedIn, it auto-detects success and grants rewards—zero extra effort.
                </p>
                <ol className="extension-steps">
                  <li>Open <code>chrome://extensions/</code></li>
                  <li>Enable Developer mode</li>
                  <li>Click Load unpacked</li>
                  <li>Select the <code>extension</code> folder in this repo</li>
                </ol>
                <p>Keep this tab open and apply on LinkedIn. Rewards appear automatically.</p>
              </div>
            )}

            {activeTab === 'stats' && (
              <StatsPanel
                state={state}
                activity={activity}
                onRefresh={fetchActivity}
              />
            )}

            {activeTab === 'profile' && (
              <div className="panel">
                <form onSubmit={handleProfileSave}>
                  <h2>Profile</h2>
                  <div className="form-row">
                    <label>
                      Name
                      <input
                        value={profileInput.displayName}
                        onChange={(e) =>
                          setProfileInput((c) => ({ ...c, displayName: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Daily goal
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={profileInput.dailyApplyGoal}
                        onChange={(e) =>
                          setProfileInput((c) => ({ ...c, dailyApplyGoal: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Roles (comma)
                    <input
                      value={profileInput.preferredRoles}
                      onChange={(e) =>
                        setProfileInput((c) => ({ ...c, preferredRoles: e.target.value }))
                      }
                    />
                  </label>
                  <button type="submit">Save profile</button>
                </form>
                <hr className="panel-divider" />
                <h3>Tuning</h3>
                <div className="form-row">
                  <label>
                    Daily cap
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={capInput}
                      onChange={(e) => setCapInput(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setState((c) => setDailyRewardCap(c, Number(capInput)))
                      setMessage('Daily reward cap updated.')
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'shop' && (
              <div className="panel">
                <h2>Upgrade Shop</h2>
                <div className="shop-row">
                  <div>
                    <p>Bath level: {state.upgrades.bathLevel}</p>
                    <p>Next: {state.upgrades.bathUpgradeCost} Zen</p>
                  </div>
                  <button type="button" onClick={handleUpgradePurchase}>
                    Buy upgrade
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'dev' && isDevMode && (
              <DevPanel state={state} setState={setState} setMessage={setMessage} />
            )}
          </div>
        </section>
      </div>

      <footer className="pasture-footer">
        <Pasture state={state} setState={setState} setMessage={setMessage} />
      </footer>
    </main>
  )
}

export default App
