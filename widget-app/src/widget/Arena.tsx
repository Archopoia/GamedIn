import { useEffect, useLayoutEffect, useRef } from 'react'
import { Application, Graphics } from 'pixi.js'
import { tickArena } from '../domain/arena-sim'
import type { SaveState } from '../domain/types'
import { COLORS_HEX } from '../theme/colors'

const ARENA_HEIGHT = 140
const LOGICAL_WIDTH = 800
const TICK_MS = 100

interface ArenaProps {
  state: SaveState
  setState: React.Dispatch<React.SetStateAction<SaveState>>
}

function syncStageFromState(
  app: Application,
  state: SaveState,
  width: number,
  height: number,
): void {
  app.stage.removeChildren()

  // Background
  const bg = new Graphics()
  bg.rect(0, 0, width, height)
  bg.fill(COLORS_HEX.bg)
  bg.rect(0, 0, width, height)
  bg.stroke({ width: 1, color: COLORS_HEX.border })
  app.stage.addChild(bg)

  const pet = state.arena.pet
  const centerX = width / 2
  const centerY = height - 40

  // Pet (circle)
  const petColor =
    pet.mood > 50
      ? COLORS_HEX.accent
      : pet.mood > 25
        ? COLORS_HEX.muted
        : COLORS_HEX.danger
  const petGfx = new Graphics()
  petGfx.circle(0, 0, 20)
  petGfx.fill(petColor)
  petGfx.stroke({ width: 1, color: COLORS_HEX.border })
  petGfx.x = centerX
  petGfx.y = centerY
  app.stage.addChild(petGfx)

  // Enemies
  for (const enemy of state.arena.enemies.slice(-8)) {
    const ex = (enemy.x / LOGICAL_WIDTH) * width
    const enemyGfx = new Graphics()
    enemyGfx.rect(0, 0, 16, 16)
    enemyGfx.fill(COLORS_HEX.dangerBorder)
    enemyGfx.x = ex
    enemyGfx.y = height / 2 - 8
    app.stage.addChild(enemyGfx)
  }

  // Projectiles
  for (const proj of (state.arena.projectiles ?? []).slice(-15)) {
    const px = (proj.x / LOGICAL_WIDTH) * width
    const projGfx = new Graphics()
    projGfx.rect(0, 0, 6, 6)
    projGfx.fill(COLORS_HEX.projectile)
    projGfx.x = px
    projGfx.y = height / 2 - 4
    app.stage.addChild(projGfx)
  }
}

export function Arena({ state, setState }: ArenaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const stateRef = useRef(state)
  const lastTickRef = useRef(0)
  stateRef.current = state

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
        className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-gamedin-muted pointer-events-none"
        title={`Cope Pet: mood reflects apply activity. ${moodLabel.charAt(0).toUpperCase() + moodLabel.slice(1)} = ${Math.round(pet.mood)}. Apply to feed it.`}
      >
        Cope Pet ({moodLabel}). Apply to feed it.
      </div>
    </div>
  )
}
