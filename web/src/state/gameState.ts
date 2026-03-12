import {
  getOrCreateArena,
  tickArenaSpawns,
  variantForApplication,
  unlockNextVariant,
} from '../domain/arena'
import { computeLevel, computeUpgradeTier } from '../domain/progression'
import { computeReward, type RewardBreakdown } from '../domain/reward'
import type { DomainEvent } from '../domain/events'
import type {
  ApplicationLog,
  ApplicationSource,
  ArenaEntity,
  SaveState,
  UpgradeState,
} from '../domain/types'

export interface ApplyCommandInput {
  title: string
  company: string
  source: ApplicationSource
  qualityScore: 1 | 2 | 3 | 4 | 5
}

export interface ApplyCommandResult {
  state: SaveState
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

export function createInitialState(): SaveState {
  const key = todayKey(new Date())
  return {
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
      entities: [
        {
          id: crypto.randomUUID(),
          variant: 'a',
          mood: 70,
          lastBoostedAt: null,
          lastInteractedAt: null,
          x: 80,
          facing: 1,
          orbAccumulated: 0,
        },
      ],
      debris: [],
      orbs: [],
      unlockedVariants: ['a'],
      arenaLevel: 1,
    },
    telemetryQueue: [],
  }
}

export function upsertProfile(
  state: SaveState,
  profile: SaveState['profile'],
): SaveState {
  return {
    ...state,
    profile,
  }
}

export function applyLoggedCommand(
  state: SaveState,
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
  const variant = variantForApplication(
    input.source,
    input.qualityScore,
    arena.unlockedVariants,
  )
  const newEntities: ArenaEntity[] = []
  for (let i = 0; i < reward.entityDelta; i++) {
    const maxX = arena.entities.length > 0
      ? Math.max(...arena.entities.map((a) => a.x)) + 60
      : 80
    newEntities.push({
      id: crypto.randomUUID(),
      variant,
      mood: 60 + input.qualityScore * 8,
      lastBoostedAt: null,
      lastInteractedAt: null,
      x: maxX + i * 50,
      facing: 1,
      orbAccumulated: 0,
    })
  }
  const nextUnlocked = arena.unlockedVariants
  const maybeUnlock = unlockNextVariant(nextUnlocked, totalApplications)
  if (maybeUnlock && !nextUnlocked.includes(maybeUnlock)) {
    nextUnlocked.push(maybeUnlock)
  }

  const nextArena: SaveState['arena'] = {
    ...arena,
    entities: [...arena.entities, ...newEntities].slice(0, 50),
    debris: arena.debris ?? [],
    orbs: arena.orbs ?? [],
    unlockedVariants: [...nextUnlocked],
  }

  const nextState: SaveState = {
    ...state,
    applications: [application, ...state.applications].slice(0, 200),
    economy: {
      points: state.economy.points + reward.pointsAwarded,
      totalPointsEarned: state.economy.totalPointsEarned + reward.pointsAwarded,
    },
    units: {
      active: nextArena.entities.length,
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
          entityDelta: reward.entityDelta,
        },
      },
    ],
  }
}

export function purchaseUpgrade(state: SaveState): {
  state: SaveState
  event: DomainEvent | null
} {
  if (state.economy.points < state.upgrades.upgradeCost) {
    return { state, event: null }
  }

  const nextLevel = state.upgrades.upgradeLevel + 1
  const nextState: SaveState = {
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

export function setDailyRewardCap(state: SaveState, cap: number): SaveState {
  return {
    ...state,
    engagement: {
      ...state.engagement,
      dailyRewardCap: Math.max(1, Math.min(cap, 20)),
    },
  }
}

export function interactEntity(state: SaveState, entityId: string): SaveState {
  const arena = getOrCreateArena(state)
  const entities = arena.entities.map((a) =>
    a.id === entityId
      ? { ...a, mood: Math.min(100, a.mood + 10), lastInteractedAt: new Date().toISOString() }
      : a,
  )
  return { ...state, arena: { ...arena, entities } }
}

export function boostEntity(state: SaveState, entityId: string): SaveState {
  const arena = getOrCreateArena(state)
  const entities = arena.entities.map((a) =>
    a.id === entityId
      ? { ...a, mood: Math.min(100, a.mood + 15), lastBoostedAt: new Date().toISOString() }
      : a,
  )
  return { ...state, arena: { ...arena, entities } }
}

export function clearDebris(state: SaveState, debrisId: string): SaveState {
  const arena = getOrCreateArena(state)
  const debrisItem = arena.debris.find((d) => d.id === debrisId)
  if (!debrisItem) return state
  const debris = arena.debris.filter((d) => d.id !== debrisId)
  const entities = arena.entities.map((a) =>
    a.id === debrisItem.entityId ? { ...a, mood: Math.min(100, a.mood + 5) } : a,
  )
  const pointsGain = 2
  return {
    ...state,
    arena: { ...arena, debris, entities },
    economy: {
      points: state.economy.points + pointsGain,
      totalPointsEarned: state.economy.totalPointsEarned + pointsGain,
    },
  }
}

export function collectOrb(state: SaveState, orbId: string): SaveState {
  const arena = getOrCreateArena(state)
  const orb = arena.orbs.find((c) => c.id === orbId)
  if (!orb) return state
  const orbs = arena.orbs.filter((c) => c.id !== orbId)
  return {
    ...state,
    arena: { ...arena, orbs },
    economy: {
      points: state.economy.points + orb.amount,
      totalPointsEarned: state.economy.totalPointsEarned + orb.amount,
    },
  }
}

export function tickArenaOrbs(
  state: SaveState,
  elapsedMs: number,
  entityPositions?: Record<string, number>,
): SaveState {
  const arena = getOrCreateArena(state)
  const { arena: nextArena } = tickArenaSpawns(arena, elapsedMs, entityPositions)
  return { ...state, arena: nextArena }
}

export function updateEntityPosition(
  state: SaveState,
  entityId: string,
  x: number,
  facing: 1 | -1,
): SaveState {
  const arena = getOrCreateArena(state)
  const entities = arena.entities.map((a) =>
    a.id === entityId ? { ...a, x, facing } : a,
  )
  return { ...state, arena: { ...arena, entities } }
}
