import type { SaveStateV1 } from '../domain/types'
import { createInitialState } from './gameState'

const STORAGE_KEY = 'gamedin.save.v1'

function isSaveState(value: unknown): value is SaveStateV1 {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Partial<SaveStateV1>
  return candidate.version === 1 && Array.isArray(candidate.applications)
}

export function serializeState(state: SaveStateV1): string {
  return JSON.stringify(state)
}

export function restoreState(serialized: string): SaveStateV1 {
  const parsed = JSON.parse(serialized) as unknown
  if (!isSaveState(parsed)) {
    return createInitialState()
  }
  return parsed
}

export function loadState(): SaveStateV1 {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) {
    return createInitialState()
  }
  try {
    return restoreState(saved)
  } catch {
    return createInitialState()
  }
}

export function saveState(state: SaveStateV1): void {
  localStorage.setItem(STORAGE_KEY, serializeState(state))
}
