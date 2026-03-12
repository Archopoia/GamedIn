export interface PageStateForGuilt {
  cardsScrolledPastCount?: number
  lastCardHoverDurationSec?: number
  applyBtnInView?: boolean
  scrollDepthPercent?: number
  totalTimeOnDetailSec?: number
}

export interface RunStateForGuilt {
  appliesToday: number
  dailyApplyGoal: number
}

export interface SessionStateForGuilt {
  tabVisible?: boolean
}

const GUILT_DEBOUNCE_MS = 120_000

const PAGE_TRIGGERS: Array<{
  check: (ps: PageStateForGuilt) => boolean
  message: (ps: PageStateForGuilt) => string
}> = [
  {
    check: (ps) => (ps.cardsScrolledPastCount ?? 0) >= 10,
    message: (ps) =>
      `${ps.cardsScrolledPastCount ?? 0} cards passed. Apply to one?`,
  },
  {
    check: (ps) => (ps.lastCardHoverDurationSec ?? 0) >= 30,
    message: () => "You've been looking at this. Apply?",
  },
  {
    check: (ps) => ps.applyBtnInView === true,
    message: () => 'Apply button visible. One click away.',
  },
  {
    check: (ps) => (ps.scrollDepthPercent ?? 0) >= 80,
    message: () => '80% scrolled. Apply before you leave.',
  },
  {
    check: (ps) => (ps.totalTimeOnDetailSec ?? 0) >= 300,
    message: (ps) => {
      const min = Math.floor((ps.totalTimeOnDetailSec ?? 0) / 60)
      return `${min} min on details. Apply to one?`
    },
  },
]

const MINUTES_TO_MIDNIGHT_FOMO = 30

/**
 * Run-based guilt triggers (near miss, sunk cost).
 * Checked first when runState is provided.
 */
function getRunGuiltMessage(
  runState: RunStateForGuilt | null,
): string | null {
  if (!runState || runState.appliesToday >= runState.dailyApplyGoal) return null
  if (runState.appliesToday === runState.dailyApplyGoal - 1) {
    return '1 more apply to complete your run.'
  }
  if (runState.appliesToday >= 1) {
    return `${runState.appliesToday}/${runState.dailyApplyGoal} applies today—finish your run.`
  }
  return null
}

/**
 * Session-ending FOMO: when tab visible and near midnight, run incomplete.
 */
function getSessionEndingGuiltMessage(
  runState: RunStateForGuilt | null,
  sessionState: SessionStateForGuilt | null,
): string | null {
  if (!runState || !sessionState?.tabVisible) return null
  if (runState.appliesToday >= runState.dailyApplyGoal) return null
  const now = new Date()
  const minutesToMidnight = (24 - now.getHours()) * 60 - now.getMinutes()
  if (minutesToMidnight <= MINUTES_TO_MIDNIGHT_FOMO && minutesToMidnight > 0) {
    return `Less than ${MINUTES_TO_MIDNIGHT_FOMO} min until midnight. One more apply?`
  }
  return null
}

/**
 * Returns guilt message when page metrics trigger (cards passed, hover duration, apply button in view, etc.).
 * Debounced: at most one message per 2 min. Checks run-based (near miss) and session-ending FOMO first.
 */
export function getGuiltMessage(
  pageState: PageStateForGuilt | null,
  lastGuiltAt: number,
  runState?: RunStateForGuilt | null,
  sessionState?: SessionStateForGuilt | null,
): { message: string; at: number } | null {
  const now = Date.now()
  if (now - lastGuiltAt < GUILT_DEBOUNCE_MS) return null

  const runMsg = getRunGuiltMessage(runState ?? null)
  if (runMsg) return { message: runMsg, at: now }

  const sessionMsg = getSessionEndingGuiltMessage(
    runState ?? null,
    sessionState ?? null,
  )
  if (sessionMsg) return { message: sessionMsg, at: now }

  if (!pageState) return null
  for (const t of PAGE_TRIGGERS) {
    if (t.check(pageState)) {
      return { message: t.message(pageState), at: now }
    }
  }
  return null
}
