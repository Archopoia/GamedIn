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
const PET_BASE_COLLIDER_RX = 42
const PET_BASE_COLLIDER_RY = 26
const ENEMY_BASE_COLLIDER_RX = 7
const ENEMY_BASE_COLLIDER_RY = 6
const LOCKED_SLIDE_SPEED = ENEMY_FORWARD_SPEED
const LOCKED_MIN_SEPARATION = 18
const LOCK_SLOT_CAPACITY = 14
const APPROACH_SLOT_ASSIGN_RADIUS = 260
const APPROACH_SLOT_BLEND_START = 220
const APPROACH_SLOT_BLEND_END = 70
const BASE_HIT_RADIUS = 7
const HIT_RADIUS_BY_DEPTH = 6
const PROJECTILE_COLLIDER_RADIUS = 3
const TARGET_RING_MIN_RADIUS = 14
const TARGET_RING_MAX_RADIUS = 30
const TARGET_RING_Y_SQUASH = 0.7
const FRONT_BLOCK_HALF_ANGLE = 0.08
const FRONT_BLOCK_HALF_WIDTH = 18
const FRONT_BLOCK_Y_MIN = PET_WORLD_Y + 2
const APPROACH_LOG_INNER_RADIUS = 60
const APPROACH_LOG_OUTER_RADIUS = 180
const debugPrevDesiredByEnemy = new Map<
  string,
  { desiredX: number; desiredY: number; slot: number; totalLocked: number }
>()
let debugPrevLockedSignature = ''
let debugLastConfigLogAt = 0

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

function sideSignFromEnemy(enemyId: string): 1 | -1 {
  let hash = 0
  for (let i = 0; i < enemyId.length; i += 1) {
    hash = (hash + enemyId.charCodeAt(i)) | 0
  }
  return hash % 2 === 0 ? 1 : -1
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
  const approachCombinedRx = PET_BASE_COLLIDER_RX + ENEMY_BASE_COLLIDER_RX
  const approachCombinedRy = PET_BASE_COLLIDER_RY + ENEMY_BASE_COLLIDER_RY
  const approachVerticalExclusion = 0.42
  const claimedSlots = new Set<number>()
  for (const existingEnemy of arena.enemies) {
    const slot = existingEnemy.lockSlot
    if (
      typeof slot === 'number' &&
      Number.isFinite(slot) &&
      slot >= 0 &&
      slot < LOCK_SLOT_CAPACITY
    ) {
      claimedSlots.add(slot)
    }
  }
  if (now - debugLastConfigLogAt > 1200) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'post-fix',hypothesisId:'H22',location:'arena-sim.ts:runtime-config-marker',message:'Runtime config marker',data:{configVersion:'contact-v3',petColliderRx:PET_BASE_COLLIDER_RX,petColliderRy:PET_BASE_COLLIDER_RY,enemyColliderRx:ENEMY_BASE_COLLIDER_RX,enemyColliderRy:ENEMY_BASE_COLLIDER_RY},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    debugLastConfigLogAt = now
  }

  // 1. Move enemies from horizon toward pet ring.
  let enemies = arena.enemies.map((e) => {
    let enemy = e
    if (e.lockedOnPet) return { ...e, ...clampToPetContactBoundary(e.x, e.y) }

    const currentDxToPet = e.x - PET_CENTER
    const currentDyToPet = e.y - PET_WORLD_Y
    const currentDistToPet = Math.hypot(currentDxToPet, currentDyToPet)
    if (
      currentDistToPet <= APPROACH_SLOT_ASSIGN_RADIUS &&
      typeof e.lockSlot !== 'number'
    ) {
      const assignedSlot = findBestAvailableSlotIndex(
        e.x,
        e.y,
        claimedSlots,
        LOCK_SLOT_CAPACITY,
        approachVerticalExclusion,
        approachCombinedRx,
        approachCombinedRy,
      )
      claimedSlots.add(assignedSlot)
      enemy = { ...e, lockSlot: assignedSlot }
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'post-fix',hypothesisId:'H26',location:'arena-sim.ts:approach-slot-assigned',message:'Assigned pre-lock slot for approach steering',data:{enemyId:e.id,assignedSlot,currentDistToPet},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    }
    if (
      currentDistToPet <= APPROACH_LOG_OUTER_RADIUS &&
      currentDistToPet >= APPROACH_LOG_INNER_RADIUS
    ) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H24',location:'arena-sim.ts:prelock-approach-state',message:'Enemy near pet but not yet locked',data:{enemyId:e.id,x:e.x,y:e.y,targetX:e.targetX,targetY:e.targetY,currentDistToPet,lockedOnPet:e.lockedOnPet ?? false,lockSlot:enemy.lockSlot},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    }
    if (
      currentDistToPet <= PET_CONTACT_HOLD_RADIUS ||
      isInsidePetContactCollider(e.x, e.y)
    ) {
      // Once an enemy reaches pet contact range, keep it there attacking.
      const clamped = clampToPetContactBoundary(e.x, e.y)
      const lockAngle = Math.atan2(clamped.y - PET_WORLD_Y, clamped.x - PET_CENTER)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H1',location:'arena-sim.ts:contact-lock-current',message:'Enemy locked from current position',data:{enemyId:e.id,x:e.x,y:e.y,lockedOnPet:e.lockedOnPet ?? false,currentDistToPet,insideContactEllipse:isInsidePetContactCollider(e.x,e.y)},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H25',location:'arena-sim.ts:lock-transition-angle',message:'Enemy lock transition angle snapshot',data:{enemyId:e.id,lockX:clamped.x,lockY:clamped.y,lockAngle,targetX:e.targetX,targetY:e.targetY,steerTargetX:e.targetX,steerTargetY:e.targetY},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H7',location:'arena-sim.ts:lock-side-current',message:'Locked enemy side snapshot',data:{enemyId:e.id,lockX:clamped.x,lockY:clamped.y,absXToCenter:Math.abs(clamped.x-PET_CENTER),side:clamped.y >= PET_WORLD_Y ? 'front' : 'back',targetY:e.targetY,targetSide:e.targetY >= PET_WORLD_Y ? 'front' : 'back'},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      if (Math.abs(clamped.x - e.x) > 6) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'post-fix',hypothesisId:'H9',location:'arena-sim.ts:side-spread-current',message:'Applied lateral spread on pet lock',data:{enemyId:e.id,fromX:e.x,toX:clamped.x,targetX:e.targetX,lockY:clamped.y},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
      }
      return {
        ...enemy,
        x: clamped.x,
        y: clamped.y,
        lockedOnPet: true,
        lockSlot: enemy.lockSlot,
      }
    }

    let steerTargetX = enemy.targetX
    let steerTargetY = enemy.targetY
    if (
      typeof enemy.lockSlot === 'number' &&
      Number.isFinite(enemy.lockSlot) &&
      enemy.lockSlot >= 0 &&
      enemy.lockSlot < LOCK_SLOT_CAPACITY
    ) {
      const slotPoint = getSlotBoundaryPoint(
        enemy.lockSlot,
        LOCK_SLOT_CAPACITY,
        approachCombinedRx,
        approachCombinedRy,
        approachVerticalExclusion,
      )
      const blend = clamp01(
        (APPROACH_SLOT_BLEND_START - currentDistToPet) /
          (APPROACH_SLOT_BLEND_START - APPROACH_SLOT_BLEND_END),
      )
      steerTargetX = enemy.targetX + (slotPoint.x - enemy.targetX) * blend
      steerTargetY = enemy.targetY + (slotPoint.y - enemy.targetY) * blend
      if (blend > 0 && blend < 1) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'post-fix',hypothesisId:'H27',location:'arena-sim.ts:approach-slot-blend',message:'Blending approach target toward final slot',data:{enemyId:e.id,slot:enemy.lockSlot,currentDistToPet,blend,baseTargetX:enemy.targetX,baseTargetY:enemy.targetY,slotTargetX:slotPoint.x,slotTargetY:slotPoint.y,steerTargetX,steerTargetY},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
      }
    }
    const nextX = e.x + (steerTargetX - e.x) * ENEMY_LATERAL_STEER * step
    const nextY =
      e.y +
      ENEMY_FORWARD_SPEED * step +
      (steerTargetY - e.y) * ENEMY_VERTICAL_STEER * step
    if (segmentHitsPetContactCollider(e.x, e.y, nextX, nextY)) {
      const clamped = clampToPetContactBoundary(nextX, nextY)
      const lockAngle = Math.atan2(clamped.y - PET_WORLD_Y, clamped.x - PET_CENTER)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H2',location:'arena-sim.ts:contact-lock-segment',message:'Enemy path intersects pet contact ellipse',data:{enemyId:e.id,fromX:e.x,fromY:e.y,toX:nextX,toY:nextY,clampedX:clamped.x,clampedY:clamped.y,targetX:e.targetX,targetY:e.targetY},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H25',location:'arena-sim.ts:lock-transition-angle',message:'Enemy lock transition angle snapshot',data:{enemyId:e.id,lockX:clamped.x,lockY:clamped.y,lockAngle,targetX:e.targetX,targetY:e.targetY,steerTargetX,steerTargetY,fromX:e.x,fromY:e.y,toX:nextX,toY:nextY},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H7',location:'arena-sim.ts:lock-side-segment',message:'Locked enemy side snapshot',data:{enemyId:e.id,fromY:e.y,toY:nextY,lockX:clamped.x,lockY:clamped.y,absXToCenter:Math.abs(clamped.x-PET_CENTER),side:clamped.y >= PET_WORLD_Y ? 'front' : 'back',targetY:e.targetY,targetSide:e.targetY >= PET_WORLD_Y ? 'front' : 'back'},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      if (Math.abs(clamped.x - nextX) > 6) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'post-fix',hypothesisId:'H9',location:'arena-sim.ts:side-spread-segment',message:'Applied lateral spread on pet lock',data:{enemyId:e.id,fromX:nextX,toX:clamped.x,targetX:e.targetX,lockY:clamped.y},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
      }
      return {
        ...enemy,
        x: clamped.x,
        y: clamped.y,
        lockedOnPet: true,
        lockSlot: enemy.lockSlot,
      }
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
        lockSlot: e.lockSlot,
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

  // Assign locked enemies to angular slots around the pet boundary.
  const lockedIndices = enemies
    .map((enemy, idx) => ({ enemy, idx }))
    .filter((item) => item.enemy.lockedOnPet)
    .sort((a, b) => a.enemy.id.localeCompare(b.enemy.id))
  if (lockedIndices.length > 0) {
    const signature = lockedIndices.map((item) => item.enemy.id).join('|')
    if (signature !== debugPrevLockedSignature) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H17',location:'arena-sim.ts:locked-signature-change',message:'Locked enemy set/order changed',data:{totalLocked:lockedIndices.length,signature},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      debugPrevLockedSignature = signature
    }
    const combinedRx = PET_BASE_COLLIDER_RX + ENEMY_BASE_COLLIDER_RX
    const combinedRy = PET_BASE_COLLIDER_RY + ENEMY_BASE_COLLIDER_RY
    const verticalExclusion = 0.42
    const usedSlots = new Set<number>()
    for (const item of lockedIndices) {
      const currentSlot = item.enemy.lockSlot
      if (
        typeof currentSlot === 'number' &&
        Number.isFinite(currentSlot) &&
        currentSlot >= 0 &&
        currentSlot < LOCK_SLOT_CAPACITY &&
        !usedSlots.has(currentSlot)
      ) {
        usedSlots.add(currentSlot)
      } else {
        const assignedSlot = findBestAvailableSlotIndex(
          item.enemy.x,
          item.enemy.y,
          usedSlots,
          LOCK_SLOT_CAPACITY,
          verticalExclusion,
          combinedRx,
          combinedRy,
        )
        usedSlots.add(assignedSlot)
        enemies[item.idx] = { ...item.enemy, lockSlot: assignedSlot }
        const currentUsed = [...usedSlots]
        const minGapAfterAssign =
          currentUsed.length < 2
            ? LOCK_SLOT_CAPACITY
            : Math.min(
                ...currentUsed.flatMap((a, i) =>
                  currentUsed.slice(i + 1).map((b) =>
                    circularSlotDistance(a, b, LOCK_SLOT_CAPACITY),
                  ),
                ),
              )
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'post-fix',hypothesisId:'H18',location:'arena-sim.ts:slot-assigned-stable',message:'Assigned stable lock slot to enemy',data:{enemyId:item.enemy.id,assignedSlot,lockSlotCapacity:LOCK_SLOT_CAPACITY,lockedTotal:lockedIndices.length,minGapAfterAssign},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
      }
    }
    for (const item of lockedIndices) {
      const enemy = enemies[item.idx]!
      const slot =
        typeof enemy.lockSlot === 'number' &&
        enemy.lockSlot >= 0 &&
        enemy.lockSlot < LOCK_SLOT_CAPACITY
          ? enemy.lockSlot
          : 0
      const angle = slotAngleAt(slot, LOCK_SLOT_CAPACITY, verticalExclusion)
      const desiredX = PET_CENTER + Math.cos(angle) * combinedRx
      const desiredY = PET_WORLD_Y + Math.sin(angle) * combinedRy
      const prevDesired = debugPrevDesiredByEnemy.get(enemy.id)
      if (
        prevDesired &&
        (prevDesired.slot !== slot ||
          Math.hypot(prevDesired.desiredX - desiredX, prevDesired.desiredY - desiredY) > 6)
      ) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'post-fix',hypothesisId:'H15',location:'arena-sim.ts:slot-reassign-jump',message:'Locked enemy desired slot changed',data:{enemyId:enemy.id,prevSlot:prevDesired.slot,nextSlot:slot,prevTotalLocked:prevDesired.totalLocked,nextTotalLocked:lockedIndices.length,prevDesiredX:prevDesired.desiredX,prevDesiredY:prevDesired.desiredY,nextDesiredX:desiredX,nextDesiredY:desiredY},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
      }
      debugPrevDesiredByEnemy.set(enemy.id, {
        desiredX,
        desiredY,
        slot,
        totalLocked: lockedIndices.length,
      })
      const dx = desiredX - enemy.x
      const dy = desiredY - enemy.y
      const distance = Math.hypot(dx, dy)
      const maxStep = LOCKED_SLIDE_SPEED * step
      const ratio = distance > 0 ? Math.min(1, maxStep / distance) : 0
      const movedX = enemy.x + dx * ratio
      const movedY = enemy.y + dy * ratio
      const moved = clampToPetContactBoundary(movedX, movedY)
      enemies[item.idx] = { ...enemy, x: moved.x, y: moved.y, lockSlot: slot }
      if (distance > 0.5) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'post-fix',hypothesisId:'H12',location:'arena-sim.ts:locked-slot-move',message:'Moved locked enemy toward surround slot',data:{enemyId:enemy.id,slot,totalLocked:lockedIndices.length,fromX:enemy.x,fromY:enemy.y,toX:moved.x,toY:moved.y,desiredX,desiredY,maxStep,slotCapacity:LOCK_SLOT_CAPACITY},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
      }
    }
  }

  // Separate locked enemies so they surround instead of stacking.
  const separatedEnemies = [...enemies]
  let separationEvents = 0
  let maxOverlap = 0
  for (let i = 0; i < separatedEnemies.length; i += 1) {
    const a = separatedEnemies[i]
    if (!a?.lockedOnPet) continue
    for (let j = i + 1; j < separatedEnemies.length; j += 1) {
      const b = separatedEnemies[j]
      if (!b?.lockedOnPet) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distance = Math.hypot(dx, dy)
      if (distance >= LOCKED_MIN_SEPARATION) continue
      const overlap = Math.min(2, (LOCKED_MIN_SEPARATION - distance) * 0.2)
      separationEvents += 1
      maxOverlap = Math.max(maxOverlap, overlap)
      const ux = distance > 0.001 ? dx / distance : sideSignFromEnemy(a.id)
      const uy = distance > 0.001 ? dy / distance : 0

      const movedA = clampToPetContactBoundary(a.x - ux * overlap, a.y - uy * overlap)
      const movedB = clampToPetContactBoundary(b.x + ux * overlap, b.y + uy * overlap)
      separatedEnemies[i] = { ...a, x: movedA.x, y: movedA.y }
      separatedEnemies[j] = { ...b, x: movedB.x, y: movedB.y }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'post-fix',hypothesisId:'H11',location:'arena-sim.ts:locked-separation',message:'Separated overlapping locked enemies',data:{enemyA:a.id,enemyB:b.id,distance,overlap,movedAX:movedA.x,movedBX:movedB.x},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    }
  }
  if (separationEvents > 0) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H16',location:'arena-sim.ts:separation-summary',message:'Locked separation activity summary',data:{separationEvents,maxOverlap,lockedCount:separatedEnemies.filter((enemy)=>enemy.lockedOnPet).length},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }
  enemies = separatedEnemies
  const lockedEnemiesForDistance = enemies.filter((enemy) => enemy.lockedOnPet)
  if (lockedEnemiesForDistance.length > 0) {
    const distanceSamples = lockedEnemiesForDistance.map((enemy) => {
      const dx = enemy.x - PET_CENTER
      const dy = enemy.y - PET_WORLD_Y
      return {
        dist: Math.hypot(dx, dy),
        absDx: Math.abs(dx),
        absDy: Math.abs(dy),
      }
    })
    const avgDist =
      distanceSamples.reduce((sum, sample) => sum + sample.dist, 0) /
      distanceSamples.length
    const minDist = Math.min(...distanceSamples.map((sample) => sample.dist))
    const maxDist = Math.max(...distanceSamples.map((sample) => sample.dist))
    const avgAbsDx =
      distanceSamples.reduce((sum, sample) => sum + sample.absDx, 0) /
      distanceSamples.length
    const avgAbsDy =
      distanceSamples.reduce((sum, sample) => sum + sample.absDy, 0) /
      distanceSamples.length
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4d53840f-0232-4abd-ad6b-8bc613945405',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H19',location:'arena-sim.ts:locked-distance-summary',message:'Locked enemy distance to pet center summary',data:{lockedCount:lockedEnemiesForDistance.length,avgDist,minDist,maxDist,avgAbsDx,avgAbsDy,petColliderRx:PET_BASE_COLLIDER_RX,petColliderRy:PET_BASE_COLLIDER_RY,enemyColliderRx:ENEMY_BASE_COLLIDER_RX,enemyColliderRy:ENEMY_BASE_COLLIDER_RY,lockedMinSeparation:LOCKED_MIN_SEPARATION},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }

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
