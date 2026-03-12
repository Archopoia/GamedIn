import type { SaveState } from '../domain/types'
import { applyLoggedCommand, createInitialState } from '../state/gameState'
import { generateTestApplication, generateTestApplications } from '../dev/fixtures'

interface DevPanelWrapperProps {
  state: SaveState
  setState: React.Dispatch<React.SetStateAction<SaveState | null>>
  setMessage: (msg: string | null) => void
  persist: (s: SaveState) => void
}

export function DevPanelWrapper({
  state,
  setState,
  setMessage,
  persist,
}: DevPanelWrapperProps) {
  const handleDevQuickApply = () => {
    const input = generateTestApplication()
    const res = applyLoggedCommand(state, input)
    setState(res.state)
    setMessage(
      `Dev: Added 1 test application (${input.title} @ ${input.company})`,
    )
    setTimeout(() => setMessage(null), 3000)
  }

  const handleDevBulkApply = (count: number) => {
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

  return (
    <div className="text-gamedin-text">
      <h3 className="m-0 mb-1.5 text-[13px] text-gamedin-accent">Dev Mode</h3>
      <p className="text-gamedin-muted text-xs m-0">
        Test features without real applications
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={handleDevQuickApply} className="gd-button">
          Quick apply (1)
        </button>
        <button
          type="button"
          onClick={() => handleDevBulkApply(5)}
          className="gd-button"
        >
          Bulk apply (5)
        </button>
        <button
          type="button"
          onClick={() => handleDevBulkApply(10)}
          className="gd-button"
        >
          Bulk apply (10)
        </button>
        <button type="button" onClick={handleDevSeedRich} className="gd-button">
          Seed rich state
        </button>
        <button
          type="button"
          onClick={handleDevReset}
          className="gd-button gd-button-danger"
        >
          Reset state
        </button>
      </div>
    </div>
  )
}
