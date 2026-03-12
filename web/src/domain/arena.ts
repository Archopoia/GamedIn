import type {
  ApplicationSource,
  ArenaCoin,
  ArenaDropping,
  ArenaState,
  ArenaUnit,
  SaveStateV1,
  UnitType,
} from './types'

const ALL_TYPES: UnitType[] = [
  'rabbit',
  'bird',
  'cat',
  'dog',
  'fox',
  'owl',
  'hedgehog',
]

const SOURCE_TYPE_MAP: Record<ApplicationSource, UnitType[]> = {
  linkedin: ['rabbit', 'bird', 'cat'],
  indeed: ['dog', 'fox'],
  glassdoor: ['owl', 'hedgehog'],
  other: ['rabbit', 'bird', 'cat', 'dog'],
}

export function getOrCreateArena(state: SaveStateV1): ArenaState {
  if (state.arena && state.arena.units.length > 0) {
    return {
      ...state.arena,
      droppings: state.arena.droppings ?? [],
      coins: state.arena.coins ?? [],
    }
  }
  const units: ArenaUnit[] = []
  const count = state.units?.active ?? 1
  for (let i = 0; i < count; i++) {
    units.push(createUnit('rabbit', 100 + i * 20))
  }
  return {
    units,
    droppings: [],
    coins: [],
    unlockedTypes: ['rabbit'],
    arenaLevel: 1,
  }
}

function createUnit(
  type: UnitType,
  x: number,
  overrides?: Partial<ArenaUnit>,
): ArenaUnit {
  return {
    id: crypto.randomUUID(),
    type,
    mood: 70,
    lastBoostedAt: null,
    lastInteractedAt: null,
    x,
    facing: 1,
    coinAccumulated: 0,
    ...overrides,
  }
}

export function unitForApplication(
  source: ApplicationSource,
  qualityScore: number,
  unlocked: UnitType[],
): UnitType {
  const pool: UnitType[] = SOURCE_TYPE_MAP[source] ?? ['rabbit']
  const available = pool.filter((c) => unlocked.includes(c))
  const choices: UnitType[] = available.length > 0 ? available : ['rabbit']
  const idx = Math.min(qualityScore - 1, choices.length - 1)
  return choices[Math.max(0, idx)] as UnitType
}

export function unlockNextType(
  unlocked: UnitType[],
  totalApplications: number,
): UnitType | null {
  const thresholds = [0, 3, 8, 15, 25, 40, 60]
  const nextIdx = unlocked.length
  if (nextIdx >= ALL_TYPES.length || totalApplications < thresholds[nextIdx]) {
    return null
  }
  return ALL_TYPES[nextIdx]!
}

const DROP_CHANCE_PER_TICK = 0.75
const DROPPING_X_OFFSET = 10
const COIN_DROP_THRESHOLD = 1

export function tickArenaDrops(
  arena: ArenaState,
  elapsedMs: number,
  unitPositions?: Record<string, number>,
): { arena: ArenaState; droppingsAdded: ArenaDropping[]; coinsAdded: ArenaCoin[] } {
  const droppingsAdded: ArenaDropping[] = []
  const coinsAdded: ArenaCoin[] = []

  const dropChance = DROP_CHANCE_PER_TICK
  const getX = (unitId: string, fallbackX: number) =>
    unitPositions?.[unitId] ?? fallbackX

  const units = arena.units.map((a) => {
    const gain = (a.mood / 100) * 0.5 * (elapsedMs / 3000)
    let coinAccumulated = a.coinAccumulated + gain
    if (coinAccumulated >= COIN_DROP_THRESHOLD) {
      const amount = Math.floor(coinAccumulated)
      coinsAdded.push({
        id: crypto.randomUUID(),
        x: getX(a.id, a.x),
        amount,
        unitId: a.id,
      })
      coinAccumulated -= amount
    }
    return { ...a, coinAccumulated }
  })

  for (const a of units) {
    if (Math.random() < dropChance) {
      const baseX = getX(a.id, a.x)
      const offset = (Math.random() - 0.5) * 2 * DROPPING_X_OFFSET
      droppingsAdded.push({
        id: crypto.randomUUID(),
        x: baseX + offset,
        unitId: a.id,
      })
    }
  }

  const droppings = [...(arena.droppings ?? []), ...droppingsAdded].slice(-80)
  const coins = [...(arena.coins ?? []), ...coinsAdded].slice(-80)

  return {
    arena: {
      ...arena,
      units,
      droppings,
      coins,
    },
    droppingsAdded,
    coinsAdded,
  }
}
