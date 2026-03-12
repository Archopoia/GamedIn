/**
 * Extension storage adapter - uses chrome.storage when in extension context.
 * Async load/save for the embedded widget.
 */

import type { SaveState } from '../domain/types'
import { getOrCreateArena } from '../domain/arena'
import { createInitialState } from '../state/gameState'

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

export function restoreState(parsed: unknown): SaveState {
  if (!isSaveState(parsed)) return createInitialState()
  const state = parsed as SaveState
  if (!state.arena || state.arena.entities.length === 0) {
    return { ...state, arena: getOrCreateArena(state) }
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

export function saveState(state: SaveState): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(state) }, () => {
        chrome?.runtime?.lastError
        resolve()
      })
    } catch {
      resolve()
    }
  })
}
