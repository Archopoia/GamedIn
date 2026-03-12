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
  )
}
