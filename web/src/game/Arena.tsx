import { useCallback, useEffect, useRef } from 'react'
import { tickArena } from '../domain/arena'
import type { EnemyType, SaveState } from '../domain/types'

const ARENA_HEIGHT = 140
const ENEMY_LABELS: Record<EnemyType, string> = {
  ghosted: 'Ghost',
  rejection: 'Reject',
  fake_job: 'Fake',
  ats_filter: 'ATS',
  rent_due: 'Rent',
  despair: 'Despair',
}
const LOGICAL_WIDTH = 800
const TICK_MS = 100

interface ArenaProps {
  state: SaveState
  setState: React.Dispatch<React.SetStateAction<SaveState>>
  setMessage: (msg: string) => void
}

export function Arena({ state, setState }: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastTickRef = useRef(performance.now())

  const draw = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      s: SaveState,
    ) => {
      ctx.fillStyle = '#0d1f18'
      ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = '#2f5345'
      ctx.lineWidth = 1
      ctx.strokeRect(0, 0, w, h)

      const pet = s.arena.pet
      const centerX = w / 2
      const centerY = h - 40

      ctx.fillStyle =
        pet.mood > 50 ? '#6ed6a3' : pet.mood > 25 ? '#94ac9d' : '#e8a8a8'
      ctx.beginPath()
      ctx.arc(centerX, centerY, 20, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#2f5345'
      ctx.stroke()

      ctx.fillStyle = '#0d1f18'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`Cope Pet (${Math.round(pet.mood)})`, centerX, centerY + 35)

      for (const enemy of s.arena.enemies.slice(-8)) {
        ctx.fillStyle = '#5a2727'
        const ex = (enemy.x / LOGICAL_WIDTH) * w
        ctx.fillRect(ex, h / 2 - 8, 16, 16)
        ctx.fillStyle = '#94ac9d'
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(ENEMY_LABELS[enemy.type] ?? enemy.type, ex + 8, h / 2 + 20)
      }

      for (const proj of (s.arena.projectiles ?? []).slice(-15)) {
        ctx.fillStyle = '#4a9c6d'
        const px = (proj.x / LOGICAL_WIDTH) * w
        ctx.fillRect(px, h / 2 - 4, 6, 6)
      }
    },
    [],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const parent = canvas.parentElement
    if (!parent) return

    const redraw = () => {
      const w = parent!.clientWidth || 800
      canvas.width = w
      canvas.height = ARENA_HEIGHT
      draw(ctx, w, ARENA_HEIGHT, state)
    }

    redraw()
    const ro = new ResizeObserver(redraw)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [state, draw])

  useEffect(() => {
    let rafId: number
    let accumulated = 0

    const loop = (now: number) => {
      const dt = Math.min(now - lastTickRef.current, 200)
      lastTickRef.current = now
      accumulated = Math.min(accumulated + dt, 500)
      while (accumulated >= TICK_MS) {
        setState((s) => tickArena(s, TICK_MS, null))
        accumulated -= TICK_MS
      }
      rafId = requestAnimationFrame(loop)
    }

    lastTickRef.current = performance.now()
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [setState])

  const pet = state.arena.pet
  const moodLabel =
    pet.mood > 50 ? 'healthy' : pet.mood > 25 ? 'hungry' : 'starving'

  return (
    <div className="arena-overlay">
      <canvas ref={canvasRef} className="arena-canvas" height={ARENA_HEIGHT} />
      <div
        className="arena-hint"
        title={`Cope Pet: mood reflects apply activity. ${moodLabel.charAt(0).toUpperCase() + moodLabel.slice(1)} = ${Math.round(pet.mood)}. Apply to feed it.`}
      >
        Cope Pet ({moodLabel}). Apply to feed it.
      </div>
    </div>
  )
}
