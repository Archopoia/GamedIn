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
const PET_CONTACT_HOLD_RADIUS = 26
const PET_BASE_COLLIDER_RX = 30
const PET_BASE_COLLIDER_RY = 20
const ENEMY_BASE_COLLIDER_RX = 7
const ENEMY_BASE_COLLIDER_RY = 6
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
    if (e.lockedOnPet) return e

    const currentDxToPet = e.x - PET_CENTER
    const currentDyToPet = e.y - PET_WORLD_Y
    const currentDistToPet = Math.hypot(currentDxToPet, currentDyToPet)
    if (
      currentDistToPet <= PET_CONTACT_HOLD_RADIUS ||
      isInsidePetContactCollider(e.x, e.y)
    ) {
      // Once an enemy reaches pet contact range, keep it there attacking.
      const clamped = clampToPetContactBoundary(e.x, e.y)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H1',location:'arena-sim.ts:contact-lock-current',message:'Enemy locked from current position',data:{enemyId:e.id,x:e.x,y:e.y,lockedOnPet:e.lockedOnPet ?? false,currentDistToPet,insideContactEllipse:isInsidePetContactCollider(e.x,e.y)},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H7',location:'arena-sim.ts:lock-side-current',message:'Locked enemy side snapshot',data:{enemyId:e.id,lockY:clamped.y,side:clamped.y >= PET_WORLD_Y ? 'front' : 'back',targetY:e.targetY,targetSide:e.targetY >= PET_WORLD_Y ? 'front' : 'back'},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      return { ...e, x: clamped.x, y: clamped.y, lockedOnPet: true }
    }

    const nextX = e.x + (e.targetX - e.x) * ENEMY_LATERAL_STEER * step
    const nextY =
      e.y +
      ENEMY_FORWARD_SPEED * step +
      (e.targetY - e.y) * ENEMY_VERTICAL_STEER * step
    if (segmentHitsPetContactCollider(e.x, e.y, nextX, nextY)) {
      const clamped = clampToPetContactBoundary(nextX, nextY)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H2',location:'arena-sim.ts:contact-lock-segment',message:'Enemy path intersects pet contact ellipse',data:{enemyId:e.id,fromX:e.x,fromY:e.y,toX:nextX,toY:nextY,clampedX:clamped.x,clampedY:clamped.y,targetX:e.targetX,targetY:e.targetY},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H7',location:'arena-sim.ts:lock-side-segment',message:'Locked enemy side snapshot',data:{enemyId:e.id,fromY:e.y,toY:nextY,lockY:clamped.y,side:clamped.y >= PET_WORLD_Y ? 'front' : 'back',targetY:e.targetY,targetSide:e.targetY >= PET_WORLD_Y ? 'front' : 'back'},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      return { ...e, x: clamped.x, y: clamped.y, lockedOnPet: true }
    }
    const nextDxToPet = nextX - PET_CENTER
    const nextDyToPet = nextY - PET_WORLD_Y
    const nextDistToPet = Math.hypot(nextDxToPet, nextDyToPet)
    if (nextDistToPet <= PET_CONTACT_HOLD_RADIUS) {
      const angle = Math.atan2(nextDyToPet, nextDxToPet)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H3',location:'arena-sim.ts:contact-lock-radius',message:'Enemy locked from radial threshold',data:{enemyId:e.id,nextX,nextY,nextDistToPet,angle,targetX:e.targetX,targetY:e.targetY},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      return {
        ...e,
        x: PET_CENTER + Math.cos(angle) * PET_CONTACT_HOLD_RADIUS,
        y: PET_WORLD_Y + Math.sin(angle) * PET_CONTACT_HOLD_RADIUS,
        lockedOnPet: true,
      }
    }

    if (
      Math.abs(nextX - PET_CENTER) < PET_BASE_COLLIDER_RX + ENEMY_BASE_COLLIDER_RX + 6 &&
      nextY > PET_WORLD_Y + PET_BASE_COLLIDER_RY + ENEMY_BASE_COLLIDER_RY + 2
    ) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H4',location:'arena-sim.ts:possible-pass-through',message:'Enemy moved below pet base without lock',data:{enemyId:e.id,fromX:e.x,fromY:e.y,toX:nextX,toY:nextY,lockedOnPet:e.lockedOnPet ?? false,targetX:e.targetX,targetY:e.targetY,currentDistToPet,nextDistToPet},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    }
    if (
      !segmentHitsPetContactCollider(e.x, e.y, nextX, nextY) &&
      (e.y - PET_WORLD_Y) * (nextY - PET_WORLD_Y) <= 0 &&
      Math.abs(nextX - PET_CENTER) < PET_BASE_COLLIDER_RX + ENEMY_BASE_COLLIDER_RX + 2
    ) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H5',location:'arena-sim.ts:center-plane-cross-no-collision',message:'Enemy crossed pet center plane without contact lock',data:{enemyId:e.id,fromX:e.x,fromY:e.y,toX:nextX,toY:nextY,targetX:e.targetX,targetY:e.targetY},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    }
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
