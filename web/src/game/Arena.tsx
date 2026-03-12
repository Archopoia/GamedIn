import { useCallback, useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { ArenaScene } from './ArenaScene'
import { getOrCreateArena } from '../domain/arena'
import type { ArenaUnit, SaveStateV1 } from '../domain/types'
import {
  boostUnit,
  cleanDropping,
  collectCoin,
  interactUnit,
  tickArenaCoins,
  updateUnitPosition,
} from '../state/gameState'

const ARENA_HEIGHT = 140

interface ArenaProps {
  state: SaveStateV1
  setState: React.Dispatch<React.SetStateAction<SaveStateV1>>
  setMessage: (msg: string) => void
}

export function Arena({ state, setState, setMessage }: ArenaProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const unitsRef = useRef<ArenaUnit[]>([])

  const arena = getOrCreateArena(state)
  unitsRef.current = arena.units

  const arenaRef = useRef(arena)
  arenaRef.current = arena

  const onInteract = useCallback(
    (id: string) => {
      setState((s) => interactUnit(s, id))
      setMessage('Interacted!')
    },
    [setState, setMessage],
  )

  const onBoost = useCallback(
    (id: string) => {
      setState((s) => boostUnit(s, id))
      setMessage('Boosted!')
    },
    [setState, setMessage],
  )

  const onClean = useCallback(
    (droppingId: string) => {
      setState((s) => cleanDropping(s, droppingId))
      setMessage('Cleaned! +2 pts')
    },
    [setState, setMessage],
  )

  const onCollectCoin = useCallback(
    (coinId: string) => {
      setState((s) => collectCoin(s, coinId))
      setMessage('Coins collected!')
    },
    [setState, setMessage],
  )

  const onPositionUpdate = useCallback(
    (id: string, x: number, facing: 1 | -1) => {
      setState((s) => updateUnitPosition(s, id, x, facing))
    },
    [setState],
  )

  const onTick = useCallback(
    (elapsedMs: number, unitPositions: Record<string, number>) => {
      setState((s) => tickArenaCoins(s, elapsedMs, unitPositions))
    },
    [setState],
  )

  useEffect(() => {
    if (!rootRef.current || gameRef.current) return

    const width = rootRef.current.clientWidth || 800
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height: ARENA_HEIGHT,
      parent: rootRef.current,
      transparent: true,
      scene: [ArenaScene],
      physics: { default: 'arcade' },
      audio: { noAudio: true },
    }

    const game = new Phaser.Game(config)
    gameRef.current = game

    game.scene.start('ArenaScene', {
      units: arena.units,
      droppings: arena.droppings ?? [],
      coins: arena.coins ?? [],
      onInteract,
      onBoost,
      onClean,
      onCollectCoin,
      onPositionUpdate,
      onTick,
    })

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Phaser init once
  }, [])

  const unitIds = arena.units.map((a) => a.id).join(',')
  const droppingsKey = (arena.droppings ?? []).map((d) => d.id).join(',')
  const coinsKey = (arena.coins ?? []).map((c) => c.id).join(',')
  const droppingsCount = (arena.droppings ?? []).length
  useEffect(() => {
    const scene = gameRef.current?.scene.getScene('ArenaScene') as
      | { setArena: (p: { units: ArenaUnit[]; droppings: unknown[]; coins: unknown[] }) => void }
      | undefined
    if (scene?.setArena) {
      scene.setArena({
        units: arenaRef.current.units,
        droppings: arenaRef.current.droppings ?? [],
        coins: arenaRef.current.coins ?? [],
      })
    }
  }, [unitIds, droppingsKey, coinsKey, droppingsCount])

  return (
    <div className="arena-overlay">
      <div ref={rootRef} className="arena-canvas" />
      <div className="arena-hint">
        Click to interact · Right-click to boost · Click items to clean/collect
      </div>
    </div>
  )
}
