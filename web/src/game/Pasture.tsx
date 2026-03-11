import { useCallback, useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { PastureScene } from './PastureScene'
import { getOrCreatePasture } from '../domain/pasture'
import type { PastureAnimal, SaveStateV1 } from '../domain/types'
import {
  cleanDropping,
  collectCoin,
  feedAnimal,
  petAnimal,
  tickPastureCoins,
  updateAnimalPosition,
} from '../state/gameState'

const PASTURE_HEIGHT = 140

interface PastureProps {
  state: SaveStateV1
  setState: React.Dispatch<React.SetStateAction<SaveStateV1>>
  setMessage: (msg: string) => void
}

export function Pasture({ state, setState, setMessage }: PastureProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const animalsRef = useRef<PastureAnimal[]>([])

  const pasture = getOrCreatePasture(state)
  animalsRef.current = pasture.animals

  const pastureRef = useRef(pasture)
  pastureRef.current = pasture

  const onPet = useCallback(
    (id: string) => {
      setState((s) => petAnimal(s, id))
      setMessage('Petted!')
    },
    [setState, setMessage],
  )

  const onFeed = useCallback(
    (id: string) => {
      setState((s) => feedAnimal(s, id))
      setMessage('Fed!')
    },
    [setState, setMessage],
  )

  const onClean = useCallback(
    (droppingId: string) => {
      setState((s) => cleanDropping(s, droppingId))
      setMessage('Cleaned! +2 Zen')
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
      setState((s) => updateAnimalPosition(s, id, x, facing))
    },
    [setState],
  )

  const onTick = useCallback(
    (elapsedMs: number, animalPositions: Record<string, number>) => {
      setState((s) => tickPastureCoins(s, elapsedMs, animalPositions))
    },
    [setState],
  )

  useEffect(() => {
    if (!rootRef.current || gameRef.current) return

    const width = rootRef.current.clientWidth || 800
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height: PASTURE_HEIGHT,
      parent: rootRef.current,
      transparent: true,
      scene: [PastureScene],
      physics: { default: 'arcade' },
    }

    const game = new Phaser.Game(config)
    gameRef.current = game

    game.scene.start('PastureScene', {
      animals: pasture.animals,
      droppings: pasture.droppings ?? [],
      coins: pasture.coins ?? [],
      onPet,
      onFeed,
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

  const animalIds = pasture.animals.map((a) => a.id).join(',')
  const droppingsKey = (pasture.droppings ?? []).map((d) => d.id).join(',')
  const coinsKey = (pasture.coins ?? []).map((c) => c.id).join(',')
  const droppingsCount = (pasture.droppings ?? []).length
  useEffect(() => {
    const scene = gameRef.current?.scene.getScene('PastureScene') as
      | { setPasture: (p: { animals: PastureAnimal[]; droppings: unknown[]; coins: unknown[] }) => void }
      | undefined
    if (scene?.setPasture) {
      scene.setPasture({
        animals: pastureRef.current.animals,
        droppings: pastureRef.current.droppings ?? [],
        coins: pastureRef.current.coins ?? [],
      })
    }
  }, [animalIds, droppingsKey, coinsKey, droppingsCount])

  return (
    <div className="pasture-overlay">
      <div ref={rootRef} className="pasture-canvas" />
      <div className="pasture-hint">
        Click to pet · Right-click to feed · Click droppings/coins to clean/collect
      </div>
    </div>
  )
}
