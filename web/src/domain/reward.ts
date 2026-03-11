import type { EngagementState, UpgradeState } from './types'

export interface RewardBreakdown {
  zenAwarded: number
  guestDelta: number
  qualityMultiplier: number
  streakBonus: number
  capped: boolean
}

const BASE_ZEN_REWARD = 10

export function computeReward(
  qualityScore: number,
  engagement: EngagementState,
  upgrades: UpgradeState,
): RewardBreakdown {
  const qualityMultiplier = 1 + (qualityScore - 1) * 0.15
  const streakBonus = Math.min(engagement.streakDays, 14)
  const upgradeBonus = 1 + upgrades.bathLevel * 0.1
  const uncappedReward = Math.round(
    BASE_ZEN_REWARD * qualityMultiplier * upgradeBonus + streakBonus,
  )
  const capped = engagement.appliesToday >= engagement.dailyRewardCap
  const zenAwarded = capped ? Math.max(2, Math.round(uncappedReward * 0.2)) : uncappedReward

  return {
    zenAwarded,
    guestDelta: qualityScore >= 4 ? 2 : 1,
    qualityMultiplier,
    streakBonus,
    capped,
  }
}
