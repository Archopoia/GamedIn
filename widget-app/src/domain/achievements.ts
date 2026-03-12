import type { SaveState } from './types'

const ACHIEVEMENT_DEFS: Array<{
  id: string
  label: string
  check: (s: SaveState) => boolean
}> = [
  { id: 'first_apply', label: 'First Application', check: (s) => s.applications.length >= 1 },
  { id: 'streak_7', label: 'Week Warrior', check: (s) => s.engagement.streakDays >= 7 },
  { id: 'run_complete', label: 'Daily Dose', check: (s) => s.run.completed },
  { id: 'applications_100', label: 'Century Club', check: (s) => s.applications.length >= 100 },
  { id: 'spin_offer', label: 'Offer?!', check: (s) => s.meta.gotOfferReceived === true },
]

export const ACHIEVEMENT_LABELS: Record<string, string> = Object.fromEntries(
  ACHIEVEMENT_DEFS.map((d) => [d.id, d.label]),
)

/**
 * Returns newly unlocked achievement IDs based on current state.
 * Does not mutate state; caller should merge into meta.achievements.
 */
export function checkAchievements(state: SaveState): string[] {
  const unlocked: string[] = []
  for (const def of ACHIEVEMENT_DEFS) {
    if (
      def.check(state) &&
      !state.meta.achievements.includes(def.id)
    ) {
      unlocked.push(def.id)
    }
  }
  return unlocked
}

/**
 * Merges new achievement IDs into state.meta.achievements and collectibles.
 * Returns state unchanged if newIds is empty.
 */
export function mergeAchievements(
  state: SaveState,
  newIds: string[],
): SaveState {
  if (newIds.length === 0) return state
  const merged = [...new Set([...state.meta.achievements, ...newIds])]
  const collectibles = [...new Set([...state.meta.collectibles, ...newIds])]
  return {
    ...state,
    meta: {
      ...state.meta,
      achievements: merged,
      collectibles,
    },
  }
}
