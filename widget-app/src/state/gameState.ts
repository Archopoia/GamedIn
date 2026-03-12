import { checkAchievements, mergeAchievements } from '../domain/achievements'
import { runSpin } from '../domain/spin'
import { getRandomUpgradeOptions } from '../domain/upgrades'
import type { DomainEvent } from '../domain/events'
import type {
  ApplicationLog,
  ApplicationSource,
  ArenaWeapon,
  SaveState,
} from '../domain/types'

export interface ApplyCommandInput {
  title: string
  company: string
  source: ApplicationSource
  qualityScore: 1 | 2 | 3 | 4 | 5
}

export interface PageStateForApply {
  timeOnDetailSec?: number
  lastCardHoverDurationSec?: number
}

export interface ApplyCommandResult {
  state: SaveState
  events: DomainEvent[]
}

function todayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function dayDiff(fromIso: string, toIso: string): number {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  const fromUtc = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  )
  const toUtc = Date.UTC(
    to.getUTCFullYear(),
    to.getUTCMonth(),
    to.getUTCDate(),
  )
  return Math.round((toUtc - fromUtc) / 86400000)
}

/** Creates fresh SaveState with today's dayKey, empty arena, single Cope Pet. */
export function createInitialState(): SaveState {
  const key = todayKey(new Date())
  const now = new Date().toISOString()
  return {
    profile: {
      displayName: '',
      preferredRoles: [],
      dailyApplyGoal: 3,
    },
    applications: [],
    economy: { hopium: 0, totalHopiumEarned: 0 },
    engagement: { streakDays: 0, lastApplyDate: null },
    run: {
      appliesToday: 0,
      dayKey: key,
      completed: false,
    },
    arena: {
      pet: {
        id: crypto.randomUUID(),
        mood: 70,
        lastFedAt: now,
      },
      enemies: [],
      weapons: [],
      projectiles: [],
    },
    meta: {
      achievements: [],
      collectibles: [],
      totalRunsCompleted: 0,
    },
    telemetryQueue: [],
    pendingSpin: null,
    pendingUpgradeOptions: null,
    pendingBonusSpin: null,
  }
}

/** Replaces profile in state. Used when user saves Hopium Config. */
export function upsertProfile(
  state: SaveState,
  profile: SaveState['profile'],
): SaveState {
  return { ...state, profile }
}

/**
 * Processes a logged application: adds to log, updates streak, runs spin, generates upgrade options.
 * Returns new state with pendingSpin and pendingUpgradeOptions; caller shows modals then confirms.
 */
export function applyLoggedCommand(
  state: SaveState,
  input: ApplyCommandInput,
  pageState?: PageStateForApply | null,
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
  const isSameDay = state.run.dayKey === currentDayKey
  const nextAppliesToday = isSameDay ? state.run.appliesToday + 1 : 1

  const streakDays = (() => {
    if (!state.engagement.lastApplyDate) return 1
    const gap = dayDiff(state.engagement.lastApplyDate, now.toISOString())
    if (gap === 0) return state.engagement.streakDays
    if (gap === 1) return state.engagement.streakDays + 1
    return 1
  })()

  const spinResult = runSpin(pageState)
  const upgradeOptions = getRandomUpgradeOptions(3)

  const runCompleted =
    nextAppliesToday >= state.profile.dailyApplyGoal && isSameDay

  const nextState: SaveState = {
    ...state,
    applications: [application, ...state.applications].slice(0, 200),
    economy: {
      hopium: state.economy.hopium + spinResult.hopiumAwarded,
      totalHopiumEarned:
        state.economy.totalHopiumEarned + spinResult.hopiumAwarded,
    },
    engagement: {
      streakDays,
      lastApplyDate: now.toISOString(),
    },
    run: {
      appliesToday: nextAppliesToday,
      dayKey: currentDayKey,
      completed: runCompleted,
    },
    arena: {
      ...state.arena,
      pet: {
        ...state.arena.pet,
        mood: Math.min(100, state.arena.pet.mood + 15),
        lastFedAt: now.toISOString(),
      },
    },
    meta: {
      ...state.meta,
      totalRunsCompleted: runCompleted
        ? state.meta.totalRunsCompleted + 1
        : state.meta.totalRunsCompleted,
      gotOfferReceived:
        spinResult.outcome === 'offer' || state.meta.gotOfferReceived,
    },
    pendingSpin: spinResult,
    pendingUpgradeOptions: upgradeOptions,
    pendingBonusSpin: runCompleted ? runSpin(pageState) : null,
  }

  const newAchievements = checkAchievements(nextState)
  const finalState =
    newAchievements.length > 0
      ? mergeAchievements(nextState, newAchievements)
      : nextState

  return {
    state: finalState,
    events: [
      { type: 'application_logged', payload: { application } },
      {
        type: 'reward_granted',
        payload: {
          hopiumAwarded: spinResult.hopiumAwarded,
          outcome: spinResult.outcome,
        },
      },
    ],
  }
}

/** Clears pendingSpin after user dismisses spin modal. */
export function confirmSpin(state: SaveState): SaveState {
  return { ...state, pendingSpin: null }
}

/** Clears pendingBonusSpin and awards its Hopium. No-op if no pending bonus. */
export function confirmBonusSpin(state: SaveState): SaveState {
  const bonus = state.pendingBonusSpin
  if (!bonus) return { ...state, pendingBonusSpin: null }
  return {
    ...state,
    pendingBonusSpin: null,
    economy: {
      hopium: state.economy.hopium + bonus.hopiumAwarded,
      totalHopiumEarned: state.economy.totalHopiumEarned + bonus.hopiumAwarded,
    },
  }
}

/** Applies chosen upgrade (weapon adds to arena.weapons). Clears pendingUpgradeOptions. */
export function selectUpgrade(
  state: SaveState,
  optionId: string,
): SaveState {
  const options = state.pendingUpgradeOptions ?? []
  const chosen = options.find((o) => o.id === optionId)
  if (!chosen) return { ...state, pendingUpgradeOptions: null }

  let nextArena = state.arena
  if (chosen.type === 'weapon') {
    const weapon: ArenaWeapon = {
      id: crypto.randomUUID(),
      weaponId: chosen.id,
      x: 100,
      lastFiredAt: Date.now(),
    }
    nextArena = {
      ...state.arena,
      weapons: [...state.arena.weapons, weapon].slice(-20),
    }
  }

  return {
    ...state,
    arena: nextArena,
    pendingUpgradeOptions: null,
  }
}

/** Resets run (appliesToday, dayKey, completed) if day changed. */
export function checkDailyReset(state: SaveState, now = new Date()): SaveState {
  const key = todayKey(now)
  if (state.run.dayKey === key) return state
  return {
    ...state,
    run: {
      appliesToday: 0,
      dayKey: key,
      completed: false,
    },
  }
}
