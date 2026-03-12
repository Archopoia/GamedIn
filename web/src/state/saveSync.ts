import type { SaveState } from '../domain/types'
import { getOrCreateArena } from '../domain/arena'
import { createInitialState } from './gameState'

const STORAGE_KEY = 'gamedin.save'

function isSaveState(value: unknown): value is SaveState {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Record<string, unknown>
  if (!Array.isArray(c.applications)) return false
  const economy = c.economy as Record<string, unknown> | undefined
  const units = c.units as Record<string, unknown> | undefined
  const upgrades = c.upgrades as Record<string, unknown> | undefined
  if (!economy || typeof economy.points !== 'number') return false
  if (!units || typeof units.active !== 'number') return false
  if (!upgrades || typeof upgrades.upgradeLevel !== 'number') return false
  return true
}

export function serializeState(state: SaveState): string {
  return JSON.stringify(state)
}

export function restoreState(serialized: string): SaveState {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return createInitialState()
  }
  if (!isSaveState(parsed)) return createInitialState()
  const state = parsed as SaveState
  if (!state.arena || state.arena.entities.length === 0) {
    return { ...state, arena: getOrCreateArena(state) }
  }
  return state
}

export function loadState(): SaveState {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return createInitialState()
  try {
    return restoreState(saved)
  } catch {
    return createInitialState()
  }
}

export function saveState(state: SaveState): void {
  localStorage.setItem(STORAGE_KEY, serializeState(state))
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
