import type { SaveState } from '../domain/types'
import { isDevMode } from '../lib/devMode'
import {
  applyLoggedCommand,
  createInitialState,
} from '../state/gameState'
import { toTelemetryEvent } from '../domain/events'
import {
  generateTestApplication,
  generateTestApplications,
} from './fixtures'

interface DevPanelProps {
  state: SaveState
  setState: React.Dispatch<React.SetStateAction<SaveState>>
  setMessage: (msg: string) => void
}

export function DevPanel({ state, setState, setMessage }: DevPanelProps) {
  if (!isDevMode) return null

  const handleQuickApply = () => {
    const input = generateTestApplication()
    setState((current: SaveState) => {
      const result = applyLoggedCommand(current, input)
      const telemetry = result.events.map((e) =>
        toTelemetryEvent(e, result.state),
      )
      return {
        ...result.state,
        telemetryQueue: [
          ...result.state.telemetryQueue,
          ...telemetry,
        ].slice(-100),
      }
    })
    setMessage(`Dev: Added 1 test application (${input.title} @ ${input.company})`)
  }

  const handleBulkApply = (count: number) => {
    const inputs = generateTestApplications(count)
    setState((current: SaveState) => {
      let next = current
      for (const input of inputs) {
        const result = applyLoggedCommand(next, input)
        next = result.state
      }
      return next
    })
    setMessage(`Dev: Added ${count} test applications`)
  }

  const handleSeedRich = () => {
    const inputs = generateTestApplications(15)
    let next = state
    for (const input of inputs) {
      const result = applyLoggedCommand(next, input)
      next = result.state
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
    setMessage('Dev: Seeded rich state')
  }

  const handleReset = () => {
    const fresh = createInitialState()
    setState(fresh)
    setMessage('Dev: Reset to initial state')
  }

  return (
    <section className="panel dev-panel">
      <h2>Dev Mode</h2>
      <p className="dev-hint">Test features without real applications</p>
      <div className="dev-actions">
        <button type="button" onClick={handleQuickApply}>
          Quick apply (1)
        </button>
        <button type="button" onClick={() => handleBulkApply(5)}>
          Bulk apply (5)
        </button>
        <button type="button" onClick={() => handleBulkApply(10)}>
          Bulk apply (10)
        </button>
        <button type="button" onClick={handleSeedRich}>
          Seed rich state
        </button>
        <button type="button" onClick={handleReset} className="dev-reset">
          Reset state
        </button>
      </div>
    </section>
  )
}
