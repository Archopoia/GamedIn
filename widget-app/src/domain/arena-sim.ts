import type { ArenaProjectile, ArenaWeapon, EnemyType, SaveState } from './types'

const ENEMY_TYPES: EnemyType[] = [
  'ghosted',
  'rejection',
  'fake_job',
  'ats_filter',
  'rent_due',
  'despair',
]

const LOGICAL_WIDTH = 800
const HORIZON_Y = 120
const PET_WORLD_Y = 860
const SPAWN_INTERVAL_MS = 4000
const ENEMY_FORWARD_SPEED = 1.15
const FIRE_INTERVAL_MS = 800
const PROJECTILE_SPEED = 8
const PET_CENTER = 400
const PET_BASE_COLLIDER_RX = 42
const PET_BASE_COLLIDER_RY = 26
const ENEMY_BASE_COLLIDER_RX = 7
const ENEMY_BASE_COLLIDER_RY = 6
const LOCKED_SLIDE_SPEED = ENEMY_FORWARD_SPEED
const LOCK_SLOT_CAPACITY = 14
const LOCK_FINALIZE_DISTANCE = 1.5
const BOUNDARY_ENGAGE_DISTANCE = 0.75
const BASE_HIT_RADIUS = 7
const HIT_RADIUS_BY_DEPTH = 6
const PROJECTILE_COLLIDER_RADIUS = 3
let spawnSlotCursor = 0

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1)
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
  const clampedT = Math.max(0, Math.min(1, t))
  const closestX = x1 + dx * clampedT
  const closestY = y1 + dy * clampedT
  return Math.hypot(px - closestX, py - closestY)
}

function isInsidePetContactCollider(
  x: number,
  y: number,
  enemyRx = ENEMY_BASE_COLLIDER_RX,
  enemyRy = ENEMY_BASE_COLLIDER_RY,
): boolean {
  const combinedRx = PET_BASE_COLLIDER_RX + enemyRx
  const combinedRy = PET_BASE_COLLIDER_RY + enemyRy
  const nx = (x - PET_CENTER) / combinedRx
  const ny = (y - PET_WORLD_Y) / combinedRy
  return nx * nx + ny * ny <= 1
}

function segmentHitsPetContactCollider(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  enemyRx = ENEMY_BASE_COLLIDER_RX,
  enemyRy = ENEMY_BASE_COLLIDER_RY,
): boolean {
  const combinedRx = PET_BASE_COLLIDER_RX + enemyRx
  const combinedRy = PET_BASE_COLLIDER_RY + enemyRy
  const nx1 = (x1 - PET_CENTER) / combinedRx
  const ny1 = (y1 - PET_WORLD_Y) / combinedRy
  const nx2 = (x2 - PET_CENTER) / combinedRx
  const ny2 = (y2 - PET_WORLD_Y) / combinedRy
  return pointToSegmentDistance(0, 0, nx1, ny1, nx2, ny2) <= 1
}

function clampToPetContactBoundary(
  x: number,
  y: number,
  enemyRx = ENEMY_BASE_COLLIDER_RX,
  enemyRy = ENEMY_BASE_COLLIDER_RY,
): { x: number; y: number } {
  const combinedRx = PET_BASE_COLLIDER_RX + enemyRx
  const combinedRy = PET_BASE_COLLIDER_RY + enemyRy
  const dx = x - PET_CENTER
  const dy = y - PET_WORLD_Y
  const denom = Math.sqrt(
    (dx * dx) / (combinedRx * combinedRx) + (dy * dy) / (combinedRy * combinedRy),
  )
  if (denom <= 0.0001) {
    return { x: PET_CENTER, y: PET_WORLD_Y + combinedRy }
  }
  return {
    x: PET_CENTER + dx / denom,
    y: PET_WORLD_Y + dy / denom,
  }
}

function slotAngleAt(
  index: number,
  count: number,
  excludeVerticalHalfAngle: number,
): number {
  const arc1 = Math.PI / 2 - excludeVerticalHalfAngle
  const arc2 = Math.PI - 2 * excludeVerticalHalfAngle
  const arc3 = Math.PI / 2 - excludeVerticalHalfAngle
  const totalArc = arc1 + arc2 + arc3
  const u = ((index + 0.5) / Math.max(count, 1)) * totalArc
  if (u < arc1) return u
  if (u < arc1 + arc2) return Math.PI / 2 + excludeVerticalHalfAngle + (u - arc1)
  return (Math.PI * 3) / 2 + excludeVerticalHalfAngle + (u - arc1 - arc2)
}

function circularSlotDistance(a: number, b: number, capacity: number): number {
  const raw = Math.abs(a - b)
  return Math.min(raw, capacity - raw)
}

function findBestAvailableSlotIndex(
  enemyX: number,
  enemyY: number,
  usedSlots: Set<number>,
  slotCapacity: number,
  excludeVerticalHalfAngle: number,
  combinedRx: number,
  combinedRy: number,
): number {
  let bestSlot = -1
  let bestMinGap = Number.NEGATIVE_INFINITY
  let bestDistance = Number.POSITIVE_INFINITY
  for (let slot = 0; slot < slotCapacity; slot += 1) {
    if (usedSlots.has(slot)) continue
    const angle = slotAngleAt(slot, slotCapacity, excludeVerticalHalfAngle)
    const slotX = PET_CENTER + Math.cos(angle) * combinedRx
    const slotY = PET_WORLD_Y + Math.sin(angle) * combinedRy
    const dist = Math.hypot(slotX - enemyX, slotY - enemyY)
    const minGapToOccupied =
      usedSlots.size === 0
        ? slotCapacity
        : Math.min(
            ...[...usedSlots].map((used) =>
              circularSlotDistance(slot, used, slotCapacity),
            ),
          )
    if (
      minGapToOccupied > bestMinGap ||
      (minGapToOccupied === bestMinGap && dist < bestDistance)
    ) {
      bestMinGap = minGapToOccupied
      bestDistance = dist
      bestSlot = slot
    }
  }
  return bestSlot >= 0 ? bestSlot : 0
}

function getSlotBoundaryPoint(
  slot: number,
  slotCapacity: number,
  combinedRx: number,
  combinedRy: number,
  verticalExclusion: number,
): { x: number; y: number } {
  const angle = slotAngleAt(slot, slotCapacity, verticalExclusion)
  return {
    x: PET_CENTER + Math.cos(angle) * combinedRx,
    y: PET_WORLD_Y + Math.sin(angle) * combinedRy,
  }
}

function stepOnContactBoundaryTowards(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  maxStep: number,
): { x: number; y: number; remaining: number } {
  const startsInside = isInsidePetContactCollider(fromX, fromY)
  let currentX = fromX
  let currentY = fromY
  let remainingStep = maxStep

  if (startsInside) {
    const boundary = clampToPetContactBoundary(fromX, fromY)
    const outDx = boundary.x - fromX
    const outDy = boundary.y - fromY
    const outDist = Math.hypot(outDx, outDy)
    if (outDist > 0.0001) {
      const outRatio = Math.min(1, remainingStep / outDist)
      currentX = fromX + outDx * outRatio
      currentY = fromY + outDy * outRatio
      remainingStep = Math.max(0, remainingStep - outDist * outRatio)
    }
  }

  const dx = toX - currentX
  const dy = toY - currentY
  const distance = Math.hypot(dx, dy)
  const ratio = distance > 0 ? Math.min(1, remainingStep / distance) : 1
  const linearX = currentX + dx * ratio
  const linearY = currentY + dy * ratio
  const moved = isInsidePetContactCollider(linearX, linearY)
    ? clampToPetContactBoundary(linearX, linearY)
    : { x: linearX, y: linearY }
  const remaining = Math.hypot(toX - moved.x, toY - moved.y)
  return { x: moved.x, y: moved.y, remaining }
}

/**
 * Pure arena simulation: spawn enemies, move projectiles, resolve hits, update pet mood.
 * No side effects. Called from Arena.tsx RAF loop.
 */
export function tickArena(state: SaveState, dtMs: number): SaveState {
  const arena = state.arena
  const now = Date.now()
  const step = dtMs / 16
  const approachCombinedRx = PET_BASE_COLLIDER_RX + ENEMY_BASE_COLLIDER_RX
  const approachCombinedRy = PET_BASE_COLLIDER_RY + ENEMY_BASE_COLLIDER_RY
  const approachVerticalExclusion = 0.42

  // 1. Move enemies directly toward their assigned boundary slots.
  // Reserve locked enemy slots first so travelers adapt around settled enemies.
  const normalizedClaimed = new Set<number>()
  for (const existingEnemy of arena.enemies) {
    const slot = existingEnemy.lockSlot
    if (
      existingEnemy.lockedOnPet &&
      typeof slot === 'number' &&
      Number.isFinite(slot) &&
      slot >= 0 &&
      slot < LOCK_SLOT_CAPACITY
    ) {
      normalizedClaimed.add(slot)
    }
  }
  let enemies = arena.enemies.map((sourceEnemy) => {
    let enemy = sourceEnemy
    const candidateSlot = Number(enemy.lockSlot ?? -1)
    const hasValidSlot =
      Number.isFinite(candidateSlot) &&
      candidateSlot >= 0 &&
      candidateSlot < LOCK_SLOT_CAPACITY
    const hasReusableSlot =
      hasValidSlot && ((enemy.lockedOnPet ?? false) || !normalizedClaimed.has(candidateSlot))

    if (!hasReusableSlot) {
      const assignedSlot = findBestAvailableSlotIndex(
        enemy.x,
        enemy.y,
        normalizedClaimed,
        LOCK_SLOT_CAPACITY,
        approachVerticalExclusion,
        approachCombinedRx,
        approachCombinedRy,
      )
      const slotPoint = getSlotBoundaryPoint(
        assignedSlot,
        LOCK_SLOT_CAPACITY,
        approachCombinedRx,
        approachCombinedRy,
        approachVerticalExclusion,
      )
      enemy = {
        ...enemy,
        lockSlot: assignedSlot,
        targetX: slotPoint.x,
        targetY: slotPoint.y,
      }
    }

    normalizedClaimed.add(Number(enemy.lockSlot ?? 0))
    const slotPoint = getSlotBoundaryPoint(
      Number(enemy.lockSlot ?? 0),
      LOCK_SLOT_CAPACITY,
      approachCombinedRx,
      approachCombinedRy,
      approachVerticalExclusion,
    )

    const targetGap = Math.hypot(enemy.targetX - slotPoint.x, enemy.targetY - slotPoint.y)
    if (targetGap > 0.75) {
      enemy = { ...enemy, targetX: slotPoint.x, targetY: slotPoint.y }
    }

    const moveTowardBoundary = (
      fromX: number,
      fromY: number,
      maxStep: number,
      allowLock: boolean,
    ): { x: number; y: number; lockedOnPet: boolean } => {
      const moved = stepOnContactBoundaryTowards(fromX, fromY, slotPoint.x, slotPoint.y, maxStep)
      const shouldLock = allowLock && moved.remaining <= LOCK_FINALIZE_DISTANCE
      return { x: moved.x, y: moved.y, lockedOnPet: shouldLock }
    }

    if (enemy.lockedOnPet) {
      const moved = moveTowardBoundary(enemy.x, enemy.y, LOCKED_SLIDE_SPEED * step, true)
      return { ...enemy, ...moved }
    }

    const dx = enemy.targetX - enemy.x
    const dy = enemy.targetY - enemy.y
    const targetDist = Math.hypot(dx, dy)
    const maxTravelStep = ENEMY_FORWARD_SPEED * step * 1.2
    const travelRatio = targetDist > 0.0001 ? Math.min(1, maxTravelStep / targetDist) : 1
    const nextX = enemy.x + dx * travelRatio
    const nextY = enemy.y + dy * travelRatio

    if (
      segmentHitsPetContactCollider(enemy.x, enemy.y, nextX, nextY) ||
      isInsidePetContactCollider(nextX, nextY)
    ) {
      const distToSlotFromCurrent = Math.hypot(slotPoint.x - enemy.x, slotPoint.y - enemy.y)
      const shouldUseBoundaryGuidance =
        distToSlotFromCurrent <= BOUNDARY_ENGAGE_DISTANCE ||
        isInsidePetContactCollider(enemy.x, enemy.y) ||
        isInsidePetContactCollider(nextX, nextY)
      if (
        !shouldUseBoundaryGuidance
      ) {
        return { ...enemy, x: nextX, y: nextY, lockedOnPet: false }
      }
      const moved = moveTowardBoundary(enemy.x, enemy.y, LOCKED_SLIDE_SPEED * step, true)
      return { ...enemy, ...moved }
    }

    return { ...enemy, x: nextX, y: nextY, lockedOnPet: false }
  })

  // 2. Spawn enemies
  const lastSpawn = arena.lastSpawnAt ?? now
  const shouldSpawn = now - lastSpawn >= SPAWN_INTERVAL_MS

  let nextLastSpawn = arena.lastSpawnAt ?? now
  if (shouldSpawn) {
    const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]!
    const spawnX = Math.random() * LOGICAL_WIDTH
    const spawnUsedSlots = new Set<number>()
    for (const existingEnemy of enemies) {
      const slot = existingEnemy.lockSlot
      if (
        typeof slot === 'number' &&
        Number.isFinite(slot) &&
        slot >= 0 &&
        slot < LOCK_SLOT_CAPACITY
      ) {
        spawnUsedSlots.add(slot)
      }
    }
    let spawnSlot = ((spawnSlotCursor % LOCK_SLOT_CAPACITY) + LOCK_SLOT_CAPACITY) % LOCK_SLOT_CAPACITY
    spawnSlotCursor = (spawnSlotCursor + 1) % LOCK_SLOT_CAPACITY
    if (spawnUsedSlots.has(spawnSlot)) {
      spawnSlot = findBestAvailableSlotIndex(
        spawnX,
        HORIZON_Y,
        spawnUsedSlots,
        LOCK_SLOT_CAPACITY,
        approachVerticalExclusion,
        approachCombinedRx,
        approachCombinedRy,
      )
    }
    const slotTarget = getSlotBoundaryPoint(
      spawnSlot,
      LOCK_SLOT_CAPACITY,
      approachCombinedRx,
      approachCombinedRy,
      approachVerticalExclusion,
    )
    const targetX = slotTarget.x
    const targetY = slotTarget.y
    const enemyId = crypto.randomUUID()
    enemies.push({
      id: enemyId,
      type,
      x: spawnX,
      y: HORIZON_Y,
      targetX,
      targetY,
      lockSlot: spawnSlot,
      lockedOnPet: false,
      hp: 3,
    })
    nextLastSpawn = now
  }

  enemies = enemies.filter(
    (e) =>
      e.x > -120 &&
      e.x < LOGICAL_WIDTH + 120 &&
      e.y > HORIZON_Y - 80 &&
      e.y < PET_WORLD_Y + 180,
  )
  const maxEnemies = 14
  enemies = enemies.slice(-maxEnemies)

  // 3. Weapon firing: spawn projectiles at interval
  const projectiles: ArenaProjectile[] = []
  const updatedWeapons: ArenaWeapon[] = []

  for (const weapon of arena.weapons) {
    const timeSinceFire = now - weapon.lastFiredAt
    if (timeSinceFire >= FIRE_INTERVAL_MS && enemies.length > 0) {
      const nearest = enemies.reduce((a, b) =>
        (a.x - PET_CENTER) ** 2 + (a.y - PET_WORLD_Y) ** 2 <
        (b.x - PET_CENTER) ** 2 + (b.y - PET_WORLD_Y) ** 2
          ? a
          : b,
      )
      const dx = nearest.x - PET_CENTER
      const dy = nearest.y - (PET_WORLD_Y - 20)
      const distance = Math.max(Math.hypot(dx, dy), 0.001)
      projectiles.push({
        id: crypto.randomUUID(),
        x: PET_CENTER,
        y: PET_WORLD_Y - 20,
        vx: (dx / distance) * PROJECTILE_SPEED,
        vy: (dy / distance) * PROJECTILE_SPEED,
        targetEnemyId: nearest.id,
      })
      updatedWeapons.push({ ...weapon, lastFiredAt: now })
    } else {
      updatedWeapons.push(weapon)
    }
  }

  const allProjectiles = [...(arena.projectiles ?? []), ...projectiles]

  // 4. Move projectiles
  const movedProjectiles = allProjectiles.map((p) => ({
    ...p,
    x: p.x + p.vx * step,
    y: p.y + p.vy * step,
  }))

  // 5. Hit detection: projectile hits enemy
  const hitProjectileIds = new Set<string>()
  const enemyDamage = new Map<string, number>()

  for (let i = 0; i < movedProjectiles.length; i += 1) {
    const proj = movedProjectiles[i]
    const previous = allProjectiles[i] ?? proj
    const enemy = enemies.find((e) => e.id === proj.targetEnemyId)
    if (!enemy) {
      hitProjectileIds.add(proj.id)
      continue
    }
    const depth = clamp01((enemy.y - HORIZON_Y) / (PET_WORLD_Y - HORIZON_Y))
    const hitRadius = BASE_HIT_RADIUS + depth * HIT_RADIUS_BY_DEPTH
    const distanceToPath = pointToSegmentDistance(
      enemy.x,
      enemy.y,
      previous.x,
      previous.y,
      proj.x,
      proj.y,
    )
    if (distanceToPath < hitRadius + PROJECTILE_COLLIDER_RADIUS) {
      hitProjectileIds.add(proj.id)
      enemyDamage.set(enemy.id, (enemyDamage.get(enemy.id) ?? 0) + 1)
    }
  }

  const remainingProjectiles = movedProjectiles.filter(
    (p) =>
      !hitProjectileIds.has(p.id) &&
      p.x > -100 &&
      p.x < LOGICAL_WIDTH + 100 &&
      p.y > HORIZON_Y - 120 &&
      p.y < PET_WORLD_Y + 160,
  )

  enemies = enemies.map((e) => {
    const dmg = enemyDamage.get(e.id) ?? 0
    if (dmg <= 0) return e
    return {
      ...e,
      hp: Math.max(0, e.hp - dmg),
      lastHitAt: now,
    }
  })
  enemies = enemies.filter((e) => e.hp > 0)

  // 6. Pet takes damage when enemies reach the ring around it.
  const damageRadius = 95
  let petMood = arena.pet.mood
  for (const e of enemies) {
    if (Math.hypot(e.x - PET_CENTER, e.y - PET_WORLD_Y) < damageRadius) {
      petMood = Math.max(0, petMood - 0.5)
    }
  }

  return {
    ...state,
    arena: {
      ...arena,
      enemies,
      weapons: updatedWeapons,
      projectiles: remainingProjectiles.slice(-30),
      pet: { ...arena.pet, mood: petMood },
      lastSpawnAt: nextLastSpawn,
    },
  }
}
