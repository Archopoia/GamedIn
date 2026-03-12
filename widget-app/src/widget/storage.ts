/**
 * Extension storage adapter - uses chrome.storage when in extension context.
 * Async load/save for the embedded widget.
 */

import type { SaveState } from '../domain/types'
import { createInitialState } from '../state/gameState'

const STORAGE_KEY = 'gamedin.save'

function isSaveState(value: unknown): value is SaveState {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Record<string, unknown>
  if (!Array.isArray(c.applications)) return false
  const economy = c.economy as Record<string, unknown> | undefined
  const arena = c.arena as Record<string, unknown> | undefined
  const run = c.run as Record<string, unknown> | undefined
  const meta = c.meta as Record<string, unknown> | undefined
  if (!economy || typeof economy.hopium !== 'number') return false
  if (!arena || typeof arena.pet !== 'object') return false
  if (!run || typeof run.appliesToday !== 'number') return false
  if (!meta || !Array.isArray(meta.achievements)) return false
  return true
}

export function restoreState(parsed: unknown): SaveState {
  if (!isSaveState(parsed)) return createInitialState()
  let state = parsed as SaveState
  const pet = state.arena?.pet
  if (
    !state.arena ||
    !pet ||
    typeof pet.mood !== 'number' ||
    !pet.lastFedAt
  ) {
    const fresh = createInitialState()
    return {
      ...state,
      arena: fresh.arena,
    }
  }
  const arena = state.arena
  const normalizedEnemies = Array.isArray(arena.enemies)
    ? arena.enemies.map((enemy) => {
        const e = enemy as unknown as Record<string, unknown>
        const x = typeof e.x === 'number' ? e.x : 400
        const y = typeof e.y === 'number' ? e.y : 120
        return {
          ...e,
          x,
          y,
          targetX: typeof e.targetX === 'number' ? e.targetX : x,
          targetY: typeof e.targetY === 'number' ? e.targetY : 860,
        }
      })
    : []
  const normalizedProjectiles = Array.isArray(arena.projectiles)
    ? arena.projectiles.map((projectile) => {
        const p = projectile as unknown as Record<string, unknown>
        return {
          ...p,
          y: typeof p.y === 'number' ? p.y : 860,
          vy: typeof p.vy === 'number' ? p.vy : -4,
        }
      })
    : []
  if (!Array.isArray(arena.projectiles)) {
    state = {
      ...state,
      arena: { ...arena, projectiles: [] },
    }
  }
  if (
    normalizedEnemies !== arena.enemies ||
    normalizedProjectiles !== arena.projectiles
  ) {
    state = {
      ...state,
      arena: {
        ...state.arena,
        enemies: normalizedEnemies as SaveState['arena']['enemies'],
        projectiles: normalizedProjectiles as SaveState['arena']['projectiles'],
      },
    }
  }
  const meta = state.meta
  if (
    Array.isArray(meta.achievements) &&
    (!Array.isArray(meta.collectibles) || meta.collectibles.length === 0) &&
    meta.achievements.length > 0
  ) {
    state = {
      ...state,
      meta: { ...meta, collectibles: [...meta.achievements] },
    }
  }
  if (!('pendingBonusSpin' in state) || state.pendingBonusSpin === undefined) {
    state = { ...state, pendingBonusSpin: null }
  }
  return state
}

export function loadState(): Promise<SaveState> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Promise.resolve(createInitialState())
  }
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORAGE_KEY, (result: Record<string, unknown>) => {
        const err = chrome?.runtime?.lastError
        if (err?.message?.includes('Extension context invalidated')) {
          resolve(createInitialState())
          return
        }
        const raw = result?.[STORAGE_KEY]
        if (!raw) {
          resolve(createInitialState())
          return
        }
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          resolve(restoreState(parsed))
        } catch {
          resolve(createInitialState())
        }
      })
    } catch {
      resolve(createInitialState())
    }
  })
}

export function serializeState(state: SaveState): string {
  return JSON.stringify(state)
}

export function restoreStateFromString(serialized: string): SaveState {
  try {
    const parsed = JSON.parse(serialized)
    return restoreState(parsed)
  } catch {
    return createInitialState()
  }
}

export function saveState(state: SaveState): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(state) }, () => {
        void chrome?.runtime?.lastError // consume to clear; we ignore for save
        resolve()
      })
    } catch {
      resolve()
    }
  })
}
