import type { SaveState } from '../domain/types'

export interface PageStateForDecay {
  tabVisible?: boolean
}

const HOPIUM_DECAY_PER_MIN = 0.2
const MOOD_DECAY_PER_MIN = 2

export function tickDecay(
  state: SaveState,
  pageState: PageStateForDecay | null,
  elapsedMs: number,
): SaveState {
  if (pageState?.tabVisible === true) return state

  const elapsedMin = elapsedMs / 60_000
  const hopiumLoss = Math.floor(elapsedMin * HOPIUM_DECAY_PER_MIN)
  const moodLoss = elapsedMin * MOOD_DECAY_PER_MIN

  const nextHopium = Math.max(0, state.economy.hopium - hopiumLoss)
  const nextMood = Math.max(0, state.arena.pet.mood - moodLoss)

  return {
    ...state,
    economy: {
      ...state.economy,
      hopium: nextHopium,
    },
    arena: {
      ...state.arena,
      pet: {
        ...state.arena.pet,
        mood: nextMood,
      },
    },
  }
}
