import { useCallback, useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { ArenaScene } from './ArenaScene'
import { getOrCreateArena } from '../domain/arena'
import type { ArenaEntity, SaveState } from '../domain/types'
import {
  boostEntity,
  clearDebris,
  collectOrb,
  interactEntity,
  tickArenaOrbs,
  updateEntityPosition,
} from '../state/gameState'

const ARENA_HEIGHT = 140

interface ArenaProps {
  state: SaveState
  setState: React.Dispatch<React.SetStateAction<SaveState>>
  setMessage: (msg: string) => void
}

export function Arena({ state, setState, setMessage }: ArenaProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const entitiesRef = useRef<ArenaEntity[]>([])

  const arena = getOrCreateArena(state)
  entitiesRef.current = arena.entities

  const arenaRef = useRef(arena)
  arenaRef.current = arena

  const onInteract = useCallback(
    (id: string) => {
      setState((s) => interactEntity(s, id))
      setMessage('Interacted!')
    },
    [setState, setMessage],
  )

  const onBoost = useCallback(
    (id: string) => {
      setState((s) => boostEntity(s, id))
      setMessage('Boosted!')
    },
    [setState, setMessage],
  )

  const onClearDebris = useCallback(
    (debrisId: string) => {
      setState((s) => clearDebris(s, debrisId))
      setMessage('Cleared! +2 pts')
    },
    [setState, setMessage],
  )

  const onCollectOrb = useCallback(
    (orbId: string) => {
      setState((s) => collectOrb(s, orbId))
      setMessage('Collected!')
    },
    [setState, setMessage],
  )

  const onPositionUpdate = useCallback(
    (id: string, x: number, facing: 1 | -1) => {
      setState((s) => updateEntityPosition(s, id, x, facing))
    },
    [setState],
  )

  const onTick = useCallback(
    (elapsedMs: number, entityPositions: Record<string, number>) => {
      setState((s) => tickArenaOrbs(s, elapsedMs, entityPositions))
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
      entities: arena.entities,
      debris: arena.debris ?? [],
      orbs: arena.orbs ?? [],
      onInteract,
      onBoost,
      onClearDebris,
      onCollectOrb,
      onPositionUpdate,
      onTick,
    })

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Phaser init once
  }, [])

  const entityIds = arena.entities.map((a) => a.id).join(',')
  const debrisKey = (arena.debris ?? []).map((d) => d.id).join(',')
  const orbsKey = (arena.orbs ?? []).map((c) => c.id).join(',')
  const debrisCount = (arena.debris ?? []).length
  useEffect(() => {
    const scene = gameRef.current?.scene.getScene('ArenaScene') as
      | { setArena: (p: { entities: ArenaEntity[]; debris: unknown[]; orbs: unknown[] }) => void }
      | undefined
    if (scene?.setArena) {
      scene.setArena({
        entities: arenaRef.current.entities,
        debris: arenaRef.current.debris ?? [],
        orbs: arenaRef.current.orbs ?? [],
      })
    }
  }, [entityIds, debrisKey, orbsKey, debrisCount])

  return (
    <div className="arena-overlay">
      <div ref={rootRef} className="arena-canvas" />
      <div className="arena-hint">
        Click to interact · Right-click to boost · Click items to clear/collect
      </div>
    </div>
  )
}
