import type {
  ApplicationSource,
  ArenaDebris,
  ArenaOrb,
  ArenaState,
  ArenaEntity,
  SaveState,
  EntityVariant,
} from './types'

const ALL_VARIANTS: EntityVariant[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

const SOURCE_VARIANT_MAP: Record<ApplicationSource, EntityVariant[]> = {
  linkedin: ['a', 'b', 'c'],
  indeed: ['d', 'e'],
  glassdoor: ['f', 'g'],
  other: ['a', 'b', 'c', 'd'],
}

export function getOrCreateArena(state: SaveState): ArenaState {
  if (state.arena && state.arena.entities.length > 0) {
    return {
      ...state.arena,
      debris: state.arena.debris ?? [],
      orbs: state.arena.orbs ?? [],
    }
  }
  const entities: ArenaEntity[] = []
  const count = state.units?.active ?? 1
  for (let i = 0; i < count; i++) {
    entities.push(createEntity('a', 100 + i * 20))
  }
  return {
    entities,
    debris: [],
    orbs: [],
    unlockedVariants: ['a'],
    arenaLevel: 1,
  }
}

function createEntity(
  variant: EntityVariant,
  x: number,
  overrides?: Partial<ArenaEntity>,
): ArenaEntity {
  return {
    id: crypto.randomUUID(),
    variant,
    mood: 70,
    lastBoostedAt: null,
    lastInteractedAt: null,
    x,
    facing: 1,
    orbAccumulated: 0,
    ...overrides,
  }
}

export function variantForApplication(
  source: ApplicationSource,
  qualityScore: number,
  unlocked: EntityVariant[],
): EntityVariant {
  const pool: EntityVariant[] = SOURCE_VARIANT_MAP[source] ?? ['a']
  const available = pool.filter((c) => unlocked.includes(c))
  const choices: EntityVariant[] = available.length > 0 ? available : ['a']
  const idx = Math.min(qualityScore - 1, choices.length - 1)
  return choices[Math.max(0, idx)] as EntityVariant
}

export function unlockNextVariant(
  unlocked: EntityVariant[],
  totalApplications: number,
): EntityVariant | null {
  const thresholds = [0, 3, 8, 15, 25, 40, 60]
  const nextIdx = unlocked.length
  if (nextIdx >= ALL_VARIANTS.length || totalApplications < thresholds[nextIdx]) {
    return null
  }
  return ALL_VARIANTS[nextIdx]!
}

const SPAWN_CHANCE_PER_TICK = 0.75
const DEBRIS_X_OFFSET = 10
const ORB_DROP_THRESHOLD = 1

export function tickArenaSpawns(
  arena: ArenaState,
  elapsedMs: number,
  entityPositions?: Record<string, number>,
): { arena: ArenaState; debrisAdded: ArenaDebris[]; orbsAdded: ArenaOrb[] } {
  const debrisAdded: ArenaDebris[] = []
  const orbsAdded: ArenaOrb[] = []

  const spawnChance = SPAWN_CHANCE_PER_TICK
  const getX = (entityId: string, fallbackX: number) =>
    entityPositions?.[entityId] ?? fallbackX

  const entities = arena.entities.map((a) => {
    const gain = (a.mood / 100) * 0.5 * (elapsedMs / 3000)
    let orbAccumulated = a.orbAccumulated + gain
    if (orbAccumulated >= ORB_DROP_THRESHOLD) {
      const amount = Math.floor(orbAccumulated)
      orbsAdded.push({
        id: crypto.randomUUID(),
        x: getX(a.id, a.x),
        amount,
        entityId: a.id,
      })
      orbAccumulated -= amount
    }
    return { ...a, orbAccumulated }
  })

  for (const a of entities) {
    if (Math.random() < spawnChance) {
      const baseX = getX(a.id, a.x)
      const offset = (Math.random() - 0.5) * 2 * DEBRIS_X_OFFSET
      debrisAdded.push({
        id: crypto.randomUUID(),
        x: baseX + offset,
        entityId: a.id,
      })
    }
  }

  const debris = [...(arena.debris ?? []), ...debrisAdded].slice(-80)
  const orbs = [...(arena.orbs ?? []), ...orbsAdded].slice(-80)

  return {
    arena: {
      ...arena,
      entities,
      debris,
      orbs,
    },
    debrisAdded,
    orbsAdded,
  }
}
