import { useEffect, useLayoutEffect, useRef } from 'react'
import { Application, Graphics } from 'pixi.js'
import { tickArena } from '../domain/arena-sim'
import type { SaveState } from '../domain/types'
import { COLORS_HEX } from '../theme/colors'

const ARENA_HEIGHT = 140
const LOGICAL_WIDTH = 800
const WORLD_HORIZON_Y = 120
const WORLD_PET_Y = 860
const TICK_MS = 100

interface ArenaProps {
  state: SaveState
  setState: React.Dispatch<React.SetStateAction<SaveState>>
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function projectWorldPoint(
  worldX: number,
  worldY: number,
  width: number,
  horizonY: number,
  petY: number,
): { x: number; y: number; depth: number } {
  const depth = clamp01((worldY - WORLD_HORIZON_Y) / (WORLD_PET_Y - WORLD_HORIZON_Y))
  const perspectiveT = 1 - (1 - depth) ** 1.3
  const screenX = (worldX / LOGICAL_WIDTH) * width
  const screenY = horizonY + (petY - horizonY) * perspectiveT
  return { x: screenX, y: screenY, depth }
}

function syncStageFromState(
  app: Application,
  state: SaveState,
  width: number,
  height: number,
): void {
  app.stage.removeChildren()
  const now = Date.now()

  // Background and vignette.
  const bg = new Graphics()
  bg.rect(0, 0, width, height)
  bg.fill(COLORS_HEX.bg)
  bg.rect(0, 0, width, height)
  bg.stroke({ width: 2, color: COLORS_HEX.border })
  app.stage.addChild(bg)

  const glowTop = new Graphics()
  glowTop.ellipse(width * 0.25, 0, width * 0.5, height * 0.5)
  glowTop.fill({ color: COLORS_HEX.accent, alpha: 0.09 })
  app.stage.addChild(glowTop)

  const glowBottom = new Graphics()
  glowBottom.ellipse(width * 0.8, height * 0.95, width * 0.45, height * 0.35)
  glowBottom.fill({ color: COLORS_HEX.burgundy, alpha: 0.13 })
  app.stage.addChild(glowBottom)

  const pet = state.arena.pet
  const centerX = width / 2
  const bob = Math.sin(now / 180) * 1.5
  const centerY = height - 40 + bob
  const horizonY = Math.round(height * 0.33)

  const horizon = new Graphics()
  horizon.ellipse(centerX, horizonY, width * 0.62, height * 0.1)
  horizon.stroke({ width: 1.5, color: COLORS_HEX.border, alpha: 0.38 })
  app.stage.addChild(horizon)

  const horizonGlow = new Graphics()
  horizonGlow.ellipse(centerX, horizonY - 2, width * 0.4, height * 0.06)
  horizonGlow.fill({ color: COLORS_HEX.accent, alpha: 0.09 })
  app.stage.addChild(horizonGlow)

  // Pet color state.
  const petColor =
    pet.mood > 50
      ? COLORS_HEX.accent
      : pet.mood > 25
        ? COLORS_HEX.muted
        : COLORS_HEX.danger
  // Enemies rise from the horizon and scale as they approach.
  const renderEnemies = [...state.arena.enemies]
    .slice(-14)
    .sort((a, b) => a.y - b.y)
    .map((enemy) => {
      const projected = projectWorldPoint(
        enemy.x,
        enemy.y,
        width,
        horizonY,
        centerY + 18,
      )
      const reveal = clamp01((projected.depth - 0.04) / 0.25)
      const hitAgeMs =
        typeof enemy.lastHitAt === 'number' ? now - enemy.lastHitAt : Infinity
      const hitFlash = clamp01(1 - hitAgeMs / 180)
      const pulse =
        0.1 +
        ((Math.sin((now + enemy.x * 15 + enemy.y * 0.4) / 260) + 1) / 2) * 0.12
      const enemySize = 4 + projected.depth * 16
      return { projected, reveal, hitFlash, pulse, enemySize }
    })

  const drawEnemy = (enemy: (typeof renderEnemies)[number]): void => {
    const { projected, reveal, hitFlash, pulse, enemySize } = enemy
    const enemyAura = new Graphics()
    enemyAura.circle(0, 0, enemySize * 0.9)
    enemyAura.fill({ color: COLORS_HEX.enemyCore, alpha: pulse * reveal })
    enemyAura.x = projected.x
    enemyAura.y = projected.y
    app.stage.addChild(enemyAura)

    const enemyGfx = new Graphics()
    enemyGfx.rect(0, 0, enemySize, enemySize)
    enemyGfx.fill(hitFlash > 0 ? COLORS_HEX.danger : COLORS_HEX.burgundy)
    enemyGfx.rect(1.5, 1.5, Math.max(2, enemySize - 3), Math.max(2, enemySize - 3))
    enemyGfx.fill(COLORS_HEX.enemyCore)
    enemyGfx.stroke({ width: 1, color: COLORS_HEX.danger, alpha: reveal })
    enemyGfx.alpha = reveal
    enemyGfx.x = projected.x - enemySize / 2
    enemyGfx.y = projected.y - enemySize / 2
    app.stage.addChild(enemyGfx)

    if (hitFlash > 0) {
      const hitRing = new Graphics()
      hitRing.circle(0, 0, enemySize * (0.55 + (1 - hitFlash) * 0.75))
      hitRing.stroke({
        width: 1.5,
        color: COLORS_HEX.textBright,
        alpha: hitFlash * reveal,
      })
      hitRing.x = projected.x
      hitRing.y = projected.y
      app.stage.addChild(hitRing)
    }
  }

  // Draw enemies behind pet first to preserve depth.
  for (const enemy of renderEnemies) {
    if (enemy.projected.y <= centerY + 2) drawEnemy(enemy)
  }

  // Pet with soft shadow and core.
  const petShadow = new Graphics()
  petShadow.ellipse(0, 0, 26, 9)
  petShadow.fill({ color: COLORS_HEX.petShadow, alpha: 0.28 })
  petShadow.x = centerX
  petShadow.y = centerY + 24
  app.stage.addChild(petShadow)

  const petAura = new Graphics()
  petAura.circle(0, 0, 28 + Math.sin(now / 220) * 2)
  petAura.fill({ color: COLORS_HEX.accent, alpha: 0.09 })
  petAura.x = centerX
  petAura.y = centerY
  app.stage.addChild(petAura)

  const petGfx = new Graphics()
  petGfx.circle(0, 0, 20)
  petGfx.fill(petColor)
  petGfx.stroke({ width: 2, color: COLORS_HEX.border })

  const petCore = new Graphics()
  petCore.circle(0, 0, 10)
  petCore.fill({ color: COLORS_HEX.textBright, alpha: 0.24 })

  petGfx.x = centerX
  petGfx.y = centerY
  app.stage.addChild(petGfx)
  petCore.x = centerX
  petCore.y = centerY - 2
  app.stage.addChild(petCore)

  // Draw enemies in front after pet to complete 3D wrap-around.
  for (const enemy of renderEnemies) {
    if (enemy.projected.y > centerY + 2) drawEnemy(enemy)
  }

  // Projectiles with trails.
  for (const proj of (state.arena.projectiles ?? []).slice(-15)) {
    const projected = projectWorldPoint(
      proj.x,
      proj.y,
      width,
      horizonY,
      centerY + 18,
    )
    const projectileSize = 3 + projected.depth * 4

    const trail = new Graphics()
    trail.rect(0, 0, projectileSize * 1.8, projectileSize * 0.5)
    trail.fill({ color: COLORS_HEX.accent, alpha: 0.22 })
    trail.x = projected.x - projectileSize * 1.5
    trail.y = projected.y - projectileSize * 0.25
    app.stage.addChild(trail)

    const projGfx = new Graphics()
    projGfx.rect(0, 0, projectileSize, projectileSize)
    projGfx.fill(COLORS_HEX.projectile)
    projGfx.stroke({ width: 1, color: COLORS_HEX.textBright, alpha: 0.85 })
    projGfx.x = projected.x - projectileSize / 2
    projGfx.y = projected.y - projectileSize / 2
    app.stage.addChild(projGfx)
  }
}

export function Arena({ state, setState }: ArenaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const stateRef = useRef(state)
  const lastTickRef = useRef(0)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    let mounted = true

    void (async () => {
      await app.init({
        width: container.clientWidth || 800,
        height: ARENA_HEIGHT,
        background: COLORS_HEX.bg,
        resizeTo: container,
        antialias: false,
        eventFeatures: {
          move: false,
          globalMove: false,
          click: false,
          wheel: false,
        },
      })
      if (!mounted) {
        app.destroy(true, { children: true })
        return
      }
      container.appendChild(app.canvas)
      appRef.current = app
      syncStageFromState(app, stateRef.current, app.screen.width, app.screen.height)
    })()

    return () => {
      mounted = false
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const app = appRef.current
    if (!app) return
    syncStageFromState(app, state, app.screen.width, app.screen.height)
  }, [state])

  useEffect(() => {
    let rafId: number
    let accumulated = 0

    const loop = (now: number) => {
      if (lastTickRef.current === 0) lastTickRef.current = now
      const dt = Math.min(now - lastTickRef.current, 200)
      lastTickRef.current = now
      accumulated = Math.min(accumulated + dt, 500)
      while (accumulated >= TICK_MS) {
        setState((s) => tickArena(s, TICK_MS))
        accumulated -= TICK_MS
      }
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [setState])

  const pet = state.arena.pet
  const moodLabel =
    pet.mood > 50 ? 'healthy' : pet.mood > 25 ? 'hungry' : 'starving'

  return (
    <div className="w-full h-[140px] relative">
      <div ref={containerRef} className="w-full h-[140px] block" />
      <div
        className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-gamedin-muted pointer-events-none px-2 py-0.5 rounded-full border border-gamedin-border/60 bg-gamedin-bg/60 backdrop-blur-[1px]"
        title={`Cope Pet: mood reflects apply activity. ${moodLabel.charAt(0).toUpperCase() + moodLabel.slice(1)} = ${Math.round(pet.mood)}. Apply to feed it.`}
      >
        Cope Pet ({moodLabel}). Apply to feed it.
      </div>
    </div>
  )
}
