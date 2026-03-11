import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { compliancePolicy } from './compliance/policy'
import { DevPanel } from './dev/DevPanel'
import { isDevMode } from './lib/devMode'
import { toTelemetryEvent } from './domain/events'
import { applicationInputSchema, profileSchema } from './domain/validation'
import { Pasture } from './game/Pasture'
import { initAnalytics, trackEvent } from './lib/analytics'
import {
  applyLoggedCommand,
  createInitialState,
  purchaseBathUpgrade,
  setDailyRewardCap,
  upsertProfile,
} from './state/gameState'
import { loadState, saveState } from './state/saveSync'

type TabId = 'apply' | 'profile' | 'shop' | 'dev'

function App() {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') {
      return createInitialState()
    }
    return loadState()
  })
  const [activeTab, setActiveTab] = useState<TabId>('apply')
  const [profileInput, setProfileInput] = useState({
    displayName: state.profile.displayName,
    preferredRoles: state.profile.preferredRoles.join(', '),
    dailyApplyGoal: state.profile.dailyApplyGoal.toString(),
  })
  const [applyInput, setApplyInput] = useState({
    title: '',
    company: '',
    source: 'linkedin',
    qualityScore: '3',
  })
  const [message, setMessage] = useState('Welcome to your cozy application loop.')
  const [capInput, setCapInput] = useState(state.engagement.dailyRewardCap.toString())

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    saveState(state)
    state.telemetryQueue.forEach((event) => trackEvent(event))
  }, [state])

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

  const handleApplicationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = applicationInputSchema.safeParse({
      title: applyInput.title,
      company: applyInput.company,
      source: applyInput.source,
      qualityScore: Number(applyInput.qualityScore),
    })

    if (!parsed.success) {
      setMessage('Application validation failed. Please complete all fields.')
      return
    }

    setState((current) => {
      const result = applyLoggedCommand(current, {
        ...parsed.data,
        qualityScore: parsed.data.qualityScore as 1 | 2 | 3 | 4 | 5,
      })
      const telemetry = result.events.map((domainEvent) =>
        toTelemetryEvent(domainEvent, result.state),
      )
      return {
        ...result.state,
        telemetryQueue: [...result.state.telemetryQueue, ...telemetry].slice(-100),
      }
    })
    setApplyInput({
      title: '',
      company: '',
      source: applyInput.source,
      qualityScore: applyInput.qualityScore,
    })
    setMessage('Application logged. Rewards granted.')
  }

  const handleDropFromCard = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return
      try {
        const data = JSON.parse(raw) as {
          title: string
          company: string
          source: string
          qualityScore: number
        }
        const parsed = applicationInputSchema.safeParse(data)
        if (!parsed.success) return
        setState((current) => {
          const result = applyLoggedCommand(current, {
            ...parsed.data,
            qualityScore: parsed.data.qualityScore as 1 | 2 | 3 | 4 | 5,
          })
          const telemetry = result.events.map((domainEvent) =>
            toTelemetryEvent(domainEvent, result.state),
          )
          return {
            ...result.state,
            telemetryQueue: [...result.state.telemetryQueue, ...telemetry].slice(-100),
          }
        })
        setApplyInput({ title: '', company: '', source: data.source, qualityScore: String(data.qualityScore) })
        setMessage('Application logged! New critter joined the pasture.')
      } catch {
        // ignore
      }
    },
    [setState, setMessage, setApplyInput],
  )

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
    { id: 'apply', label: 'Log Apply' },
    { id: 'profile', label: 'Profile' },
    { id: 'shop', label: 'Shop' },
    ...(isDevMode ? [{ id: 'dev' as TabId, label: 'Dev' }] : []),
  ]

  return (
    <main className="app-shell">
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
            {activeTab === 'apply' && (
              <form className="panel compact-form" onSubmit={handleApplicationSubmit}>
                <h2>Log Application</h2>
                <p className="apply-hint">Fill the form and click Submit, or drag the card to the pasture below.</p>
                <div className="form-row">
                  <label>
                    Role
                    <input
                      value={applyInput.title}
                      onChange={(e) => setApplyInput((c) => ({ ...c, title: e.target.value }))}
                      placeholder="e.g. Frontend Engineer"
                    />
                  </label>
                  <label>
                    Company
                    <input
                      value={applyInput.company}
                      onChange={(e) => setApplyInput((c) => ({ ...c, company: e.target.value }))}
                      placeholder="e.g. Acme Corp"
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Source
                    <select
                      value={applyInput.source}
                      onChange={(e) =>
                        setApplyInput((c) => ({ ...c, source: e.target.value }))
                      }
                    >
                      <option value="linkedin">LinkedIn</option>
                      <option value="indeed">Indeed</option>
                      <option value="glassdoor">Glassdoor</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Fit (1–5)
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={applyInput.qualityScore}
                      onChange={(e) =>
                        setApplyInput((c) => ({ ...c, qualityScore: e.target.value }))
                      }
                    />
                  </label>
                  <button type="submit">Submit</button>
                </div>
                {applyInput.title.trim() && applyInput.company.trim() && (
                  <div
                    className="job-card-draggable"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'application/json',
                        JSON.stringify({
                          title: applyInput.title,
                          company: applyInput.company,
                          source: applyInput.source,
                          qualityScore: Number(applyInput.qualityScore),
                        }),
                      )
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                  >
                    <span className="job-card-role">{applyInput.title}</span>
                    <span className="job-card-company">{applyInput.company}</span>
                    <span className="job-card-hint">Drag to pasture →</span>
                  </div>
                )}
              </form>
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

      <footer
        className="pasture-footer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropFromCard}
      >
        <Pasture state={state} setState={setState} setMessage={setMessage} />
      </footer>
    </main>
  )
}

export default App
