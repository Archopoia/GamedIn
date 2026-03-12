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
const ENEMY_LATERAL_STEER = 0.035
const ENEMY_VERTICAL_STEER = 0.00025
const FIRE_INTERVAL_MS = 800
const PROJECTILE_SPEED = 8
const PET_CENTER = 400
const BASE_HIT_RADIUS = 7
const HIT_RADIUS_BY_DEPTH = 6
const PROJECTILE_COLLIDER_RADIUS = 3
const TARGET_RING_MIN_RADIUS = 14
const TARGET_RING_MAX_RADIUS = 30
const TARGET_RING_Y_SQUASH = 0.7
const FRONT_BLOCK_HALF_ANGLE = 0.08
const FRONT_BLOCK_HALF_WIDTH = 18
const FRONT_BLOCK_Y_MIN = PET_WORLD_Y + 2

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

function pickEnemyTargetAroundPet(): { targetX: number; targetY: number } {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = Math.random() * Math.PI * 2
    const radius =
      TARGET_RING_MIN_RADIUS +
      Math.random() * (TARGET_RING_MAX_RADIUS - TARGET_RING_MIN_RADIUS)
    const targetX = PET_CENTER + Math.cos(angle) * radius
    const targetY = PET_WORLD_Y + Math.sin(angle) * radius * TARGET_RING_Y_SQUASH

    const inBlockedFrontCone =
      Math.abs(angle - Math.PI / 2) < FRONT_BLOCK_HALF_ANGLE ||
      Math.abs(angle - (Math.PI / 2 + Math.PI * 2)) < FRONT_BLOCK_HALF_ANGLE
    const inFrontCenterLane =
      Math.abs(targetX - PET_CENTER) < FRONT_BLOCK_HALF_WIDTH &&
      targetY >= FRONT_BLOCK_Y_MIN
    if (!inBlockedFrontCone && !inFrontCenterLane) {
      return { targetX, targetY }
    }
  }

  // Fallback to side lane if random attempts all hit blocked zone.
  const sideSign = Math.random() > 0.5 ? 1 : -1
  return {
    targetX: PET_CENTER + sideSign * TARGET_RING_MAX_RADIUS * 0.8,
    targetY: PET_WORLD_Y + 2,
  }
}

/**
 * Pure arena simulation: spawn enemies, move projectiles, resolve hits, update pet mood.
 * No side effects. Called from Arena.tsx RAF loop.
 */
export function tickArena(state: SaveState, dtMs: number): SaveState {
  const arena = state.arena
  const now = Date.now()
  const step = dtMs / 16

  // 1. Move enemies from horizon toward pet ring.
  let enemies = arena.enemies.map((e) => {
    const nextX = e.x + (e.targetX - e.x) * ENEMY_LATERAL_STEER * step
    const nextY =
      e.y +
      ENEMY_FORWARD_SPEED * step +
      (e.targetY - e.y) * ENEMY_VERTICAL_STEER * step
    return { ...e, x: nextX, y: nextY }
  })

  // 2. Spawn enemies
  const lastSpawn = arena.lastSpawnAt ?? now
  const shouldSpawn = now - lastSpawn >= SPAWN_INTERVAL_MS

  let nextLastSpawn = arena.lastSpawnAt ?? now
  if (shouldSpawn) {
    const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]!
    const spawnX = Math.random() * LOGICAL_WIDTH
    const { targetX, targetY } = pickEnemyTargetAroundPet()
    enemies.push({
      id: crypto.randomUUID(),
      type,
      x: spawnX,
      y: HORIZON_Y,
      targetX,
      targetY,
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
