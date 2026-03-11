/**
 * Extension storage adapter - uses chrome.storage when in extension context.
 * Async load/save for the embedded widget.
 */

import type { SaveStateV1 } from '../domain/types'
import { getOrCreatePasture } from '../domain/pasture'
import { createInitialState } from '../state/gameState'

const STORAGE_KEY = 'gamedin.save.v1'

function isSaveState(value: unknown): value is SaveStateV1 {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Partial<SaveStateV1>
  return c.version === 1 && Array.isArray(c.applications)
}

export function restoreState(parsed: unknown): SaveStateV1 {
  if (!isSaveState(parsed)) return createInitialState()
  const state = parsed as SaveStateV1
  if (!state.pasture || state.pasture.animals.length === 0) {
    return { ...state, pasture: getOrCreatePasture(state) }
  }
  return state
}

export function loadState(): Promise<SaveStateV1> {
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

export function saveState(state: SaveStateV1): Promise<void> {
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
