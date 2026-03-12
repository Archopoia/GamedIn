import type { SaveStateV1 } from '../domain/types'
import { getOrCreateArena } from '../domain/arena'
import { createInitialState } from './gameState'

const STORAGE_KEY = 'gamedin.save.v1'

function isSaveStateV1(value: unknown): value is SaveStateV1 {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Record<string, unknown>
  if (c.version !== 1 || !Array.isArray(c.applications)) return false
  const economy = c.economy as Record<string, unknown> | undefined
  const units = c.units as Record<string, unknown> | undefined
  const upgrades = c.upgrades as Record<string, unknown> | undefined
  if (!economy || typeof economy.points !== 'number') return false
  if (!units || typeof units.active !== 'number') return false
  if (!upgrades || typeof upgrades.upgradeLevel !== 'number') return false
  return true
}

export function serializeState(state: SaveStateV1): string {
  return JSON.stringify(state)
}

export function restoreState(serialized: string): SaveStateV1 {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return createInitialState()
  }
  if (!isSaveStateV1(parsed)) return createInitialState()
  const state = parsed as SaveStateV1
  if (!state.arena || state.arena.units.length === 0) {
    return { ...state, arena: getOrCreateArena(state) }
  }
  return state
}

export function loadState(): SaveStateV1 {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return createInitialState()
  try {
    return restoreState(saved)
  } catch {
    return createInitialState()
  }
}

export function saveState(state: SaveStateV1): void {
  localStorage.setItem(STORAGE_KEY, serializeState(state))
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
