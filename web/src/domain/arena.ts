import type { ArenaProjectile, ArenaWeapon, EnemyType, SaveState } from './types'

const ENEMY_TYPES: EnemyType[] = [
  'ghosted',
  'rejection',
  'fake_job',
  'ats_filter',
  'rent_due',
  'despair',
]

const SPAWN_INTERVAL_MS = 4000
const ENEMY_SPEED = 0.8
const FIRE_INTERVAL_MS = 800
const PROJECTILE_SPEED = 4
const PET_CENTER = 400
const HIT_RADIUS = 25

/**
 * Pure arena simulation: spawn enemies, move projectiles, resolve hits, update pet mood.
 * No side effects. Called from Arena.tsx RAF loop.
 */
export function tickArena(
  state: SaveState,
  dtMs: number,
  _pageState?: { tabVisible?: boolean } | null,
): SaveState {
  const arena = state.arena
  const now = Date.now()

  // 1. Move enemies toward pet
  let enemies = arena.enemies.map((e) => {
    const direction = e.x < PET_CENTER ? 1 : -1
    const newX = e.x + direction * ENEMY_SPEED * (dtMs / 16)
    return { ...e, x: newX }
  })

  // 2. Spawn enemies
  const lastSpawn = arena.lastSpawnAt ?? now
  const shouldSpawn = now - lastSpawn >= SPAWN_INTERVAL_MS
  const spawnRate = 1 + (100 - arena.pet.mood) / 50

  let nextLastSpawn = arena.lastSpawnAt
  if (shouldSpawn && Math.random() < spawnRate * 0.5) {
    const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]!
    const fromLeft = Math.random() > 0.5
    enemies.push({
      id: crypto.randomUUID(),
      type,
      x: fromLeft ? -20 : 820,
      hp: 3,
    })
    nextLastSpawn = now
  }

  enemies = enemies.filter((e) => e.x > -50 && e.x < 870)
  const maxEnemies = 12
  enemies = enemies.slice(-maxEnemies)

  // 3. Weapon firing: spawn projectiles at interval
  const projectiles: ArenaProjectile[] = []
  const updatedWeapons: ArenaWeapon[] = []

  for (const weapon of arena.weapons) {
    const timeSinceFire = now - weapon.lastFiredAt
    if (timeSinceFire >= FIRE_INTERVAL_MS && enemies.length > 0) {
      const nearest = enemies.reduce((a, b) =>
        Math.abs(a.x - PET_CENTER) < Math.abs(b.x - PET_CENTER) ? a : b,
      )
      const vx = nearest.x < PET_CENTER ? PROJECTILE_SPEED : -PROJECTILE_SPEED
      projectiles.push({
        id: crypto.randomUUID(),
        x: PET_CENTER,
        vx,
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
    x: p.x + p.vx * (dtMs / 16),
  }))

  // 5. Hit detection: projectile hits enemy
  const hitProjectileIds = new Set<string>()
  const enemyDamage = new Map<string, number>()

  for (const proj of movedProjectiles) {
    const enemy = enemies.find((e) => e.id === proj.targetEnemyId)
    if (!enemy) {
      hitProjectileIds.add(proj.id)
      continue
    }
    if (Math.abs(proj.x - enemy.x) < HIT_RADIUS) {
      hitProjectileIds.add(proj.id)
      enemyDamage.set(enemy.id, (enemyDamage.get(enemy.id) ?? 0) + 1)
    }
  }

  const remainingProjectiles = movedProjectiles.filter(
    (p) => !hitProjectileIds.has(p.id) && p.x > -50 && p.x < 870,
  )

  enemies = enemies.map((e) => {
    const dmg = enemyDamage.get(e.id) ?? 0
    return { ...e, hp: Math.max(0, e.hp - dmg) }
  })
  enemies = enemies.filter((e) => e.hp > 0)

  // 6. Pet takes damage when enemies reach it
  const damageRadius = 50
  let petMood = arena.pet.mood
  for (const e of enemies) {
    if (Math.abs(e.x - PET_CENTER) < damageRadius) {
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
