import type { SpinResult, SpinOutcome } from './types'

export interface PageStateForSpin {
  timeOnDetailSec?: number
  lastCardHoverDurationSec?: number
}

const OUTCOME_WEIGHTS: Record<SpinOutcome, number> = {
  ghosted: 60,
  rejected: 25,
  interview: 12,
  offer: 3,
}

const HOPIUM_BY_OUTCOME: Record<SpinOutcome, number> = {
  ghosted: 5,
  rejected: 12,
  interview: 25,
  offer: 50,
}

const OUTCOMES: SpinOutcome[] = ['ghosted', 'rejected', 'interview', 'offer']

function getWeightedOutcome(boostRare: boolean): SpinOutcome {
  let weights = [...OUTCOMES].map((o) => OUTCOME_WEIGHTS[o])
  if (boostRare) {
    weights = weights.map((w, i) =>
      i === 0 ? w * 0.9 : i === 3 ? w * 1.5 : w,
    )
  }
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < OUTCOMES.length; i++) {
    r -= weights[i]!
    if (r <= 0) return OUTCOMES[i]!
  }
  return OUTCOMES[0]!
}

export function runSpin(pageState?: PageStateForSpin | null): SpinResult {
  const boostRare =
    (pageState?.timeOnDetailSec ?? 0) >= 60 ||
    (pageState?.lastCardHoverDurationSec ?? 0) >= 20
  const outcome = getWeightedOutcome(boostRare)
  const hopiumAwarded = HOPIUM_BY_OUTCOME[outcome] ?? 5
  return {
    outcome,
    hopiumAwarded,
    timestamp: new Date().toISOString(),
  }
}
