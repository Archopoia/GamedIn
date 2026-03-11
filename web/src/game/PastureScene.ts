import Phaser from 'phaser'
import type { PastureAnimal, PastureCoin, PastureDropping } from '../domain/types'

const PASTURE_HEIGHT = 140
const CRITTER_COLORS: Record<string, number> = {
  rabbit: 0xf5deb3,
  bird: 0x87ceeb,
  cat: 0xffa500,
  dog: 0x8b4513,
  fox: 0xff6347,
  owl: 0x4a3728,
  hedgehog: 0x808080,
}

export interface PastureSceneData {
  animals: PastureAnimal[]
  droppings: PastureDropping[]
  coins: PastureCoin[]
  onPet: (id: string) => void
  onFeed: (id: string) => void
  onClean: (droppingId: string) => void
  onCollectCoin: (coinId: string) => void
  onPositionUpdate: (id: string, x: number, facing: 1 | -1) => void
  onTick: (elapsedMs: number, animalPositions: Record<string, number>) => void
}

export class PastureScene extends Phaser.Scene {
  private animals: PastureAnimal[] = []
  private droppings: PastureDropping[] = []
  private coins: PastureCoin[] = []
  private onPet!: (id: string) => void
  private onFeed!: (id: string) => void
  private onClean!: (droppingId: string) => void
  private onCollectCoin!: (coinId: string) => void
  private onPositionUpdate!: (id: string, x: number, facing: 1 | -1) => void
  private onTick!: (elapsedMs: number, animalPositions: Record<string, number>) => void
  private sprites: Map<string, Phaser.GameObjects.Container> = new Map()
  private poopSprites: Map<string, Phaser.GameObjects.Ellipse> = new Map()
  private coinSprites: Map<string, Phaser.GameObjects.Arc> = new Map()
  private positionSyncAcc = 0
  private tickAcc = 0

  constructor() {
    super({ key: 'PastureScene' })
  }

  init(data: PastureSceneData) {
    this.animals = data.animals ?? []
    this.droppings = data.droppings ?? []
    this.coins = data.coins ?? []
    this.onPet = data.onPet ?? (() => {})
    this.onFeed = data.onFeed ?? (() => {})
    this.onClean = data.onClean ?? (() => {})
    this.onCollectCoin = data.onCollectCoin ?? (() => {})
    this.onPositionUpdate = data.onPositionUpdate ?? (() => {})
    this.onTick = data.onTick ?? (() => {})
  }

  create() {
    const w = this.scale.width
    const grass = this.add.rectangle(0, 0, w * 2, PASTURE_HEIGHT, 0x2d5a27, 1)
    grass.setOrigin(0, 0)
    grass.setScrollFactor(0)
    this.add.existing(grass)

    const grassLine = this.add.rectangle(0, PASTURE_HEIGHT - 4, w * 2, 4, 0x1e4620, 1)
    grassLine.setOrigin(0, 0)
    grassLine.setScrollFactor(0)
    this.add.existing(grassLine)

    this.animals.forEach((a) => this.spawnAnimal(a))
    this.droppings.forEach((d) => this.spawnDropping(d))
    this.coins.forEach((c) => this.spawnCoin(c))
  }

  update(_t: number, dt: number) {
    this.positionSyncAcc += dt
    const shouldSync = this.positionSyncAcc > 2000
    if (shouldSync) this.positionSyncAcc = 0

    this.tickAcc += dt
    if (this.tickAcc >= 2000) {
      const animalPositions: Record<string, number> = {}
      this.animals.forEach((animal) => {
        const container = this.sprites.get(animal.id)
        if (container) animalPositions[animal.id] = container.x
      })
      this.onTick(this.tickAcc, animalPositions)
      this.tickAcc = 0
    }

    this.animals.forEach((animal) => {
      const container = this.sprites.get(animal.id)
      if (!container) return

      const facing: 1 | -1 = container.scaleX >= 0 ? 1 : -1
      const speed = 20 + (animal.mood / 100) * 30
      const newX = container.x + facing * (speed * dt) / 1000
      const w = this.scale.width

      let nx = newX
      let nextFacing: 1 | -1 = facing
      if (newX <= 30 || newX >= w - 30) {
        nextFacing = (facing * -1) as 1 | -1
        nx = Phaser.Math.Clamp(newX, 30, w - 30)
      }

      container.x = nx
      container.setScale(nextFacing, 1)
      if (shouldSync) this.onPositionUpdate(animal.id, nx, nextFacing)
    })
  }

  setPasture(pasture: { animals: PastureAnimal[]; droppings: PastureDropping[]; coins: PastureCoin[] }) {
    const prevAnimalIds = new Set(this.animals.map((a) => a.id))
    const nextAnimalIds = new Set(pasture.animals.map((a) => a.id))
    this.animals = pasture.animals

    for (const animal of pasture.animals) {
      const container = this.sprites.get(animal.id)
      if (container) {
        container.setData('animal', animal)
      } else {
        this.spawnAnimal(animal)
      }
    }

    for (const id of prevAnimalIds) {
      if (!nextAnimalIds.has(id)) {
        this.sprites.get(id)?.destroy()
        this.sprites.delete(id)
      }
    }

    const prevDroppingIds = new Set(this.droppings.map((d) => d.id))
    const nextDroppingIds = new Set(pasture.droppings.map((d) => d.id))
    this.droppings = pasture.droppings

    for (const d of pasture.droppings) {
      if (!this.poopSprites.has(d.id)) {
        this.spawnDropping(d)
      }
    }
    for (const id of prevDroppingIds) {
      if (!nextDroppingIds.has(id)) {
        this.poopSprites.get(id)?.destroy()
        this.poopSprites.delete(id)
      }
    }

    const prevCoinIds = new Set(this.coins.map((c) => c.id))
    const nextCoinIds = new Set(pasture.coins.map((c) => c.id))
    this.coins = pasture.coins

    for (const c of pasture.coins) {
      if (!this.coinSprites.has(c.id)) {
        this.spawnCoin(c)
      }
    }
    for (const id of prevCoinIds) {
      if (!nextCoinIds.has(id)) {
        this.coinSprites.get(id)?.destroy()
        this.coinSprites.delete(id)
      }
    }
  }

  private spawnDropping(d: PastureDropping) {
    const poop = this.add.ellipse(d.x, PASTURE_HEIGHT / 2 + 14, 8, 5, 0x5c4033)
    poop.setStrokeStyle(1, 0x3d2b1f)
    poop.setDepth(2)
    poop.setInteractive(new Phaser.Geom.Ellipse(0, 0, 28, 20), Phaser.Geom.Ellipse.Contains)
    poop.setData('droppingId', d.id)
    const droppingId = d.id
    poop.on('pointerdown', () => {
      this.poopSprites.get(droppingId)?.destroy()
      this.poopSprites.delete(droppingId)
      this.onClean(droppingId)
    })
    this.poopSprites.set(d.id, poop)
  }

  private spawnCoin(c: PastureCoin) {
    const coin = this.add.circle(c.x, PASTURE_HEIGHT / 2 - 18, 6, 0xffd700)
    coin.setStrokeStyle(1, 0xb8860b)
    coin.setDepth(2)
    coin.setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains)
    coin.setData('coinId', c.id)
    const coinId = c.id
    coin.on('pointerdown', () => {
      this.coinSprites.get(coinId)?.destroy()
      this.coinSprites.delete(coinId)
      this.onCollectCoin(coinId)
    })
    this.coinSprites.set(c.id, coin)
  }

  private spawnAnimal(animal: PastureAnimal) {
    const color = CRITTER_COLORS[animal.type] ?? 0xffffff
    const body = this.add.ellipse(0, 0, 24, 18, color)
    body.setStrokeStyle(2, 0x1a1a1a)

    const eye = this.add.circle(6, -2, 3, 0x000000)
    const container = this.add.container(animal.x, PASTURE_HEIGHT / 2, [body, eye])
    container.setScale(animal.facing, 1)
    container.setDepth(1)

    container.setInteractive(
      new Phaser.Geom.Ellipse(0, 0, 48, 40),
      Phaser.Geom.Ellipse.Contains,
    )
    container.setData('animal', animal)

    container.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const a = container.getData('animal') as PastureAnimal
      if (ptr.rightButtonDown()) {
        this.onFeed(a.id)
      } else {
        this.onPet(a.id)
      }
    })

    this.sprites.set(animal.id, container)
  }
}
