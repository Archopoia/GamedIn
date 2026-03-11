import type {
  ApplicationSource,
  CritterType,
  PastureAnimal,
  PastureCoin,
  PastureDropping,
  PastureState,
  SaveStateV1,
} from './types'

const ALL_CRITTERS: CritterType[] = [
  'rabbit',
  'bird',
  'cat',
  'dog',
  'fox',
  'owl',
  'hedgehog',
]

const SOURCE_CRITTER_MAP: Record<ApplicationSource, CritterType[]> = {
  linkedin: ['rabbit', 'bird', 'cat'],
  indeed: ['dog', 'fox'],
  glassdoor: ['owl', 'hedgehog'],
  other: ['rabbit', 'bird', 'cat', 'dog'],
}

export function getOrCreatePasture(state: SaveStateV1): PastureState {
  if (state.pasture && state.pasture.animals.length > 0) {
    return {
      ...state.pasture,
      droppings: state.pasture.droppings ?? [],
      coins: state.pasture.coins ?? [],
    }
  }
  const animals: PastureAnimal[] = []
  const count = state.guests?.active ?? 1
  for (let i = 0; i < count; i++) {
    animals.push(createAnimal('rabbit', 100 + i * 20))
  }
  return {
    animals,
    droppings: [],
    coins: [],
    unlockedCritters: ['rabbit'],
    pastureLevel: 1,
  }
}

function createAnimal(
  type: CritterType,
  x: number,
  overrides?: Partial<PastureAnimal>,
): PastureAnimal {
  return {
    id: crypto.randomUUID(),
    type,
    mood: 70,
    lastFedAt: null,
    lastPettedAt: null,
    x,
    facing: 1,
    coinAccumulated: 0,
    ...overrides,
  }
}

export function critterForApplication(
  source: ApplicationSource,
  qualityScore: number,
  unlocked: CritterType[],
): CritterType {
  const pool: CritterType[] = SOURCE_CRITTER_MAP[source] ?? ['rabbit']
  const available = pool.filter((c) => unlocked.includes(c))
  const choices: CritterType[] = available.length > 0 ? available : ['rabbit']
  const idx = Math.min(qualityScore - 1, choices.length - 1)
  return choices[Math.max(0, idx)] as CritterType
}

export function unlockNextCritter(
  unlocked: CritterType[],
  totalApplications: number,
): CritterType | null {
  const thresholds = [0, 3, 8, 15, 25, 40, 60]
  const nextIdx = unlocked.length
  if (nextIdx >= ALL_CRITTERS.length || totalApplications < thresholds[nextIdx]) {
    return null
  }
  return ALL_CRITTERS[nextIdx]!
}

const POOP_CHANCE_PER_TICK = 0.75
const DROPPING_X_OFFSET = 10 // spread droppings so they don't overlap
const COIN_DROP_THRESHOLD = 1

export function tickPastureDrops(
  pasture: PastureState,
  elapsedMs: number,
  animalPositions?: Record<string, number>,
): { pasture: PastureState; droppingsAdded: PastureDropping[]; coinsAdded: PastureCoin[] } {
  const droppingsAdded: PastureDropping[] = []
  const coinsAdded: PastureCoin[] = []

  const poopChance = POOP_CHANCE_PER_TICK
  const getX = (animalId: string, fallbackX: number) =>
    animalPositions?.[animalId] ?? fallbackX

  const animals = pasture.animals.map((a) => {
    const gain = (a.mood / 100) * 0.5 * (elapsedMs / 3000)
    let coinAccumulated = a.coinAccumulated + gain
    if (coinAccumulated >= COIN_DROP_THRESHOLD) {
      const amount = Math.floor(coinAccumulated)
      coinsAdded.push({
        id: crypto.randomUUID(),
        x: getX(a.id, a.x),
        amount,
        animalId: a.id,
      })
      coinAccumulated -= amount
    }
    return { ...a, coinAccumulated }
  })

  for (const a of animals) {
    if (Math.random() < poopChance) {
      const baseX = getX(a.id, a.x)
      const offset = (Math.random() - 0.5) * 2 * DROPPING_X_OFFSET
      droppingsAdded.push({
        id: crypto.randomUUID(),
        x: baseX + offset,
        animalId: a.id,
      })
    }
  }

  const droppings = [...(pasture.droppings ?? []), ...droppingsAdded].slice(-80)
  const coins = [...(pasture.coins ?? []), ...coinsAdded].slice(-80)

  return {
    pasture: {
      ...pasture,
      animals,
      droppings,
      coins,
    },
    droppingsAdded,
    coinsAdded,
  }
}
