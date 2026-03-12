import { useCallback, useEffect, useRef } from 'react'
import { tickArena } from '../domain/arena'
import type { EnemyType, SaveState } from '../domain/types'
import { COLORS } from '../theme/colors'

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
  const lastTickRef = useRef(0)

  const draw = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      s: SaveState,
    ) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = COLORS.border
      ctx.lineWidth = 1
      ctx.strokeRect(0, 0, w, h)

      const pet = s.arena.pet
      const centerX = w / 2
      const centerY = h - 40

      ctx.fillStyle =
        pet.mood > 50 ? COLORS.accent : pet.mood > 25 ? COLORS.muted : COLORS.danger
      ctx.beginPath()
      ctx.arc(centerX, centerY, 20, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = COLORS.border
      ctx.stroke()

      ctx.fillStyle = COLORS.bg
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`Cope Pet (${Math.round(pet.mood)})`, centerX, centerY + 35)

      for (const enemy of s.arena.enemies.slice(-8)) {
        ctx.fillStyle = COLORS.dangerBorder
        const ex = (enemy.x / LOGICAL_WIDTH) * w
        ctx.fillRect(ex, h / 2 - 8, 16, 16)
        ctx.fillStyle = COLORS.muted
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(ENEMY_LABELS[enemy.type] ?? enemy.type, ex + 8, h / 2 + 20)
      }

      for (const proj of (s.arena.projectiles ?? []).slice(-15)) {
        ctx.fillStyle = COLORS.projectile
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
      <canvas ref={canvasRef} className="w-full h-[140px] block" height={ARENA_HEIGHT} />
      <div
        className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-gamedin-muted pointer-events-none"
        title={`Cope Pet: mood reflects apply activity. ${moodLabel.charAt(0).toUpperCase() + moodLabel.slice(1)} = ${Math.round(pet.mood)}. Apply to feed it.`}
      >
        Cope Pet ({moodLabel}). Apply to feed it.
      </div>
    </div>
  )
}
