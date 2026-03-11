import { computeBathTier, computeLevel } from '../domain/progression'
import { computeReward, type RewardBreakdown } from '../domain/reward'
import type { DomainEvent } from '../domain/events'
import type {
  ApplicationLog,
  ApplicationSource,
  SaveStateV1,
  UpgradeState,
} from '../domain/types'

export interface ApplyCommandInput {
  title: string
  company: string
  source: ApplicationSource
  qualityScore: 1 | 2 | 3 | 4 | 5
}

export interface ApplyCommandResult {
  state: SaveStateV1
  events: DomainEvent[]
  reward: RewardBreakdown
}

const DEFAULT_UPGRADES: UpgradeState = {
  bathLevel: 1,
  bathUpgradeCost: 80,
}

function todayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function dayDiff(fromIso: string, toIso: string): number {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.round((toUtc - fromUtc) / 86400000)
}

export function createInitialState(): SaveStateV1 {
  const key = todayKey(new Date())
  return {
    version: 1,
    profile: {
      displayName: '',
      preferredRoles: [],
      dailyApplyGoal: 3,
    },
    applications: [],
    economy: {
      zen: 0,
      totalZenEarned: 0,
    },
    guests: {
      active: 1,
      happiestGuestMood: 50,
    },
    progression: {
      level: 1,
      totalApplications: 0,
      unlockedBathTier: 1,
    },
    engagement: {
      streakDays: 0,
      lastApplyDate: null,
      appliesToday: 0,
      appliesDayKey: key,
      dailyRewardCap: 5,
    },
    upgrades: DEFAULT_UPGRADES,
    telemetryQueue: [],
  }
}

export function upsertProfile(
  state: SaveStateV1,
  profile: SaveStateV1['profile'],
): SaveStateV1 {
  return {
    ...state,
    profile,
  }
}

export function applyLoggedCommand(
  state: SaveStateV1,
  input: ApplyCommandInput,
  now = new Date(),
): ApplyCommandResult {
  const application: ApplicationLog = {
    id: crypto.randomUUID(),
    title: input.title,
    company: input.company,
    source: input.source,
    qualityScore: input.qualityScore,
    createdAt: now.toISOString(),
  }

  const currentDayKey = todayKey(now)
  const isSameDay = state.engagement.appliesDayKey === currentDayKey
  const nextAppliesToday = isSameDay ? state.engagement.appliesToday + 1 : 1

  const streakDays = (() => {
    if (!state.engagement.lastApplyDate) {
      return 1
    }
    const gap = dayDiff(state.engagement.lastApplyDate, now.toISOString())
    if (gap === 0) {
      return state.engagement.streakDays
    }
    if (gap === 1) {
      return state.engagement.streakDays + 1
    }
    return 1
  })()

  const reward = computeReward(
    input.qualityScore,
    { ...state.engagement, appliesToday: nextAppliesToday },
    state.upgrades,
  )
  const totalApplications = state.progression.totalApplications + 1
  const level = computeLevel(totalApplications)
  const unlockedBathTier = computeBathTier(level)

  const nextState: SaveStateV1 = {
    ...state,
    applications: [application, ...state.applications].slice(0, 200),
    economy: {
      zen: state.economy.zen + reward.zenAwarded,
      totalZenEarned: state.economy.totalZenEarned + reward.zenAwarded,
    },
    guests: {
      active: state.guests.active + reward.guestDelta,
      happiestGuestMood: Math.min(100, state.guests.happiestGuestMood + input.qualityScore),
    },
    progression: {
      totalApplications,
      level,
      unlockedBathTier,
    },
    engagement: {
      ...state.engagement,
      appliesToday: nextAppliesToday,
      appliesDayKey: currentDayKey,
      lastApplyDate: now.toISOString(),
      streakDays,
    },
  }

  return {
    state: nextState,
    reward,
    events: [
      {
        type: 'application_logged',
        payload: { application },
      },
      {
        type: 'reward_granted',
        payload: {
          zenAwarded: reward.zenAwarded,
          guestDelta: reward.guestDelta,
        },
      },
    ],
  }
}

export function purchaseBathUpgrade(state: SaveStateV1): {
  state: SaveStateV1
  event: DomainEvent | null
} {
  if (state.economy.zen < state.upgrades.bathUpgradeCost) {
    return { state, event: null }
  }

  const nextLevel = state.upgrades.bathLevel + 1
  const nextState: SaveStateV1 = {
    ...state,
    economy: {
      ...state.economy,
      zen: state.economy.zen - state.upgrades.bathUpgradeCost,
    },
    upgrades: {
      bathLevel: nextLevel,
      bathUpgradeCost: Math.round(state.upgrades.bathUpgradeCost * 1.8),
    },
  }

  return {
    state: nextState,
    event: {
      type: 'upgrade_purchased',
      payload: {
        upgrade: 'bath',
        newLevel: nextLevel,
      },
    },
  }
}

export function setDailyRewardCap(state: SaveStateV1, cap: number): SaveStateV1 {
  return {
    ...state,
    engagement: {
      ...state.engagement,
      dailyRewardCap: Math.max(1, Math.min(cap, 20)),
    },
  }
}
