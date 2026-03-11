import { type FormEvent, useEffect, useMemo, useState } from 'react'
import './App.css'
import { compliancePolicy } from './compliance/policy'
import { toTelemetryEvent } from './domain/events'
import { applicationInputSchema, profileSchema } from './domain/validation'
import { GameCanvas } from './game/GameCanvas'
import { initAnalytics, trackEvent } from './lib/analytics'
import {
  applyLoggedCommand,
  createInitialState,
  purchaseBathUpgrade,
  setDailyRewardCap,
  upsertProfile,
} from './state/gameState'
import { loadState, saveState } from './state/saveSync'

function App() {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') {
      return createInitialState()
    }
    return loadState()
  })
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

  return (
    <main className="app-shell">
      <header>
        <h1>GamedIn MVP</h1>
        <p className="subtitle">{compliancePolicy.statement}</p>
      </header>

      <section className="panel metrics">
        <div>
          <h2>Progress</h2>
          <p>Zen: {state.economy.zen}</p>
          <p>Guests: {state.guests.active}</p>
          <p>Level: {state.progression.level}</p>
          <p>Streak: {state.engagement.streakDays} days</p>
        </div>
        <div>
          <h2>Daily Goal</h2>
          <p>{state.engagement.appliesToday} applications logged today</p>
          <div className="progress-track" role="progressbar" aria-valuenow={todayProgress}>
            <span style={{ width: `${todayProgress}%` }} />
          </div>
          <p>{todayProgress}% complete</p>
        </div>
      </section>

      <section className="panel">
        <GameCanvas guests={state.guests.active} />
      </section>

      <section className="panel form-grid">
        <form onSubmit={handleProfileSave}>
          <h2>Onboarding</h2>
          <label>
            Display name
            <input
              value={profileInput.displayName}
              onChange={(event) =>
                setProfileInput((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Preferred roles (comma separated)
            <input
              value={profileInput.preferredRoles}
              onChange={(event) =>
                setProfileInput((current) => ({
                  ...current,
                  preferredRoles: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Daily apply goal
            <input
              type="number"
              min={1}
              max={20}
              value={profileInput.dailyApplyGoal}
              onChange={(event) =>
                setProfileInput((current) => ({
                  ...current,
                  dailyApplyGoal: event.target.value,
                }))
              }
            />
          </label>
          <button type="submit">Save profile</button>
        </form>

        <form onSubmit={handleApplicationSubmit}>
          <h2>Log Application</h2>
          <label>
            Role title
            <input
              value={applyInput.title}
              onChange={(event) =>
                setApplyInput((current) => ({ ...current, title: event.target.value }))
              }
            />
          </label>
          <label>
            Company
            <input
              value={applyInput.company}
              onChange={(event) =>
                setApplyInput((current) => ({
                  ...current,
                  company: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Source
            <select
              value={applyInput.source}
              onChange={(event) =>
                setApplyInput((current) => ({
                  ...current,
                  source: event.target.value,
                }))
              }
            >
              <option value="linkedin">LinkedIn</option>
              <option value="indeed">Indeed</option>
              <option value="glassdoor">Glassdoor</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Quality score (1-5)
            <input
              type="number"
              min={1}
              max={5}
              value={applyInput.qualityScore}
              onChange={(event) =>
                setApplyInput((current) => ({
                  ...current,
                  qualityScore: event.target.value,
                }))
              }
            />
          </label>
          <button type="submit">I applied</button>
        </form>
      </section>

      <section className="panel">
        <h2>Upgrade Shop</h2>
        <p>Bath level: {state.upgrades.bathLevel}</p>
        <p>Next upgrade cost: {state.upgrades.bathUpgradeCost} Zen</p>
        <button type="button" onClick={handleUpgradePurchase}>
          Buy bath upgrade
        </button>
      </section>

      <section className="panel">
        <h2>Tuning Controls</h2>
        <label>
          Daily reward cap
          <input
            type="number"
            min={1}
            max={20}
            value={capInput}
            onChange={(event) => setCapInput(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setState((current) => setDailyRewardCap(current, Number(capInput)))
            setMessage('Daily reward cap updated.')
          }}
        >
          Save tuning
        </button>
      </section>

      <div className="panel status">
        <strong>Status:</strong> {message}
      </div>
    </main>
  )
}

export default App
