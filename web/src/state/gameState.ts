import {
  getOrCreateArena,
  tickArenaDrops,
  unitForApplication,
  unlockNextType,
} from '../domain/arena'
import { computeLevel, computeUpgradeTier } from '../domain/progression'
import { computeReward, type RewardBreakdown } from '../domain/reward'
import type { DomainEvent } from '../domain/events'
import type {
  ApplicationLog,
  ApplicationSource,
  ArenaUnit,
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
  upgradeLevel: 1,
  upgradeCost: 80,
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
      points: 0,
      totalPointsEarned: 0,
    },
    units: {
      active: 1,
      happiestMood: 50,
    },
    progression: {
      level: 1,
      totalApplications: 0,
      unlockedUpgradeTier: 1,
    },
    engagement: {
      streakDays: 0,
      lastApplyDate: null,
      appliesToday: 0,
      appliesDayKey: key,
      dailyRewardCap: 5,
    },
    upgrades: DEFAULT_UPGRADES,
    arena: {
      units: [
        {
          id: crypto.randomUUID(),
          type: 'rabbit',
          mood: 70,
          lastBoostedAt: null,
          lastInteractedAt: null,
          x: 80,
          facing: 1,
          coinAccumulated: 0,
        },
      ],
      droppings: [],
      coins: [],
      unlockedTypes: ['rabbit'],
      arenaLevel: 1,
    },
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
  const unlockedUpgradeTier = computeUpgradeTier(level)

  const arena = getOrCreateArena(state)
  const unitType = unitForApplication(
    input.source,
    input.qualityScore,
    arena.unlockedTypes,
  )
  const newUnits: ArenaUnit[] = []
  for (let i = 0; i < reward.unitDelta; i++) {
    const maxX = arena.units.length > 0
      ? Math.max(...arena.units.map((a) => a.x)) + 60
      : 80
    newUnits.push({
      id: crypto.randomUUID(),
      type: unitType,
      mood: 60 + input.qualityScore * 8,
      lastBoostedAt: null,
      lastInteractedAt: null,
      x: maxX + i * 50,
      facing: 1,
      coinAccumulated: 0,
    })
  }
  const nextUnlocked = arena.unlockedTypes
  const maybeUnlock = unlockNextType(nextUnlocked, totalApplications)
  if (maybeUnlock && !nextUnlocked.includes(maybeUnlock)) {
    nextUnlocked.push(maybeUnlock)
  }

  const nextArena: SaveStateV1['arena'] = {
    ...arena,
    units: [...arena.units, ...newUnits].slice(0, 50),
    droppings: arena.droppings ?? [],
    coins: arena.coins ?? [],
    unlockedTypes: [...nextUnlocked],
  }

  const nextState: SaveStateV1 = {
    ...state,
    applications: [application, ...state.applications].slice(0, 200),
    economy: {
      points: state.economy.points + reward.pointsAwarded,
      totalPointsEarned: state.economy.totalPointsEarned + reward.pointsAwarded,
    },
    units: {
      active: nextArena.units.length,
      happiestMood: Math.min(100, state.units.happiestMood + input.qualityScore),
    },
    arena: nextArena,
    progression: {
      totalApplications,
      level,
      unlockedUpgradeTier,
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
          pointsAwarded: reward.pointsAwarded,
          unitDelta: reward.unitDelta,
        },
      },
    ],
  }
}

export function purchaseUpgrade(state: SaveStateV1): {
  state: SaveStateV1
  event: DomainEvent | null
} {
  if (state.economy.points < state.upgrades.upgradeCost) {
    return { state, event: null }
  }

  const nextLevel = state.upgrades.upgradeLevel + 1
  const nextState: SaveStateV1 = {
    ...state,
    economy: {
      ...state.economy,
      points: state.economy.points - state.upgrades.upgradeCost,
    },
    upgrades: {
      upgradeLevel: nextLevel,
      upgradeCost: Math.round(state.upgrades.upgradeCost * 1.8),
    },
  }

  return {
    state: nextState,
    event: {
      type: 'upgrade_purchased',
      payload: {
        upgrade: 'facility',
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

export function interactUnit(state: SaveStateV1, unitId: string): SaveStateV1 {
  const arena = getOrCreateArena(state)
  const units = arena.units.map((a) =>
    a.id === unitId
      ? { ...a, mood: Math.min(100, a.mood + 10), lastInteractedAt: new Date().toISOString() }
      : a,
  )
  return { ...state, arena: { ...arena, units } }
}

export function boostUnit(state: SaveStateV1, unitId: string): SaveStateV1 {
  const arena = getOrCreateArena(state)
  const units = arena.units.map((a) =>
    a.id === unitId
      ? { ...a, mood: Math.min(100, a.mood + 15), lastBoostedAt: new Date().toISOString() }
      : a,
  )
  return { ...state, arena: { ...arena, units } }
}

export function cleanDropping(state: SaveStateV1, droppingId: string): SaveStateV1 {
  const arena = getOrCreateArena(state)
  const dropping = arena.droppings.find((d) => d.id === droppingId)
  if (!dropping) return state
  const droppings = arena.droppings.filter((d) => d.id !== droppingId)
  const units = arena.units.map((a) =>
    a.id === dropping.unitId ? { ...a, mood: Math.min(100, a.mood + 5) } : a,
  )
  const pointsGain = 2
  return {
    ...state,
    arena: { ...arena, droppings, units },
    economy: {
      points: state.economy.points + pointsGain,
      totalPointsEarned: state.economy.totalPointsEarned + pointsGain,
    },
  }
}

export function collectCoin(state: SaveStateV1, coinId: string): SaveStateV1 {
  const arena = getOrCreateArena(state)
  const coin = arena.coins.find((c) => c.id === coinId)
  if (!coin) return state
  const coins = arena.coins.filter((c) => c.id !== coinId)
  return {
    ...state,
    arena: { ...arena, coins },
    economy: {
      points: state.economy.points + coin.amount,
      totalPointsEarned: state.economy.totalPointsEarned + coin.amount,
    },
  }
}

export function tickArenaCoins(
  state: SaveStateV1,
  elapsedMs: number,
  unitPositions?: Record<string, number>,
): SaveStateV1 {
  const arena = getOrCreateArena(state)
  const { arena: nextArena } = tickArenaDrops(arena, elapsedMs, unitPositions)
  return { ...state, arena: nextArena }
}

export function updateUnitPosition(
  state: SaveStateV1,
  unitId: string,
  x: number,
  facing: 1 | -1,
): SaveStateV1 {
  const arena = getOrCreateArena(state)
  const units = arena.units.map((a) =>
    a.id === unitId ? { ...a, x, facing } : a,
  )
  return { ...state, arena: { ...arena, units } }
}
