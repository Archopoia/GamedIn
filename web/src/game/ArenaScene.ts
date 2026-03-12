import Phaser from 'phaser'
import type { ArenaCoin, ArenaDropping, ArenaUnit } from '../domain/types'

const ARENA_HEIGHT = 140
const UNIT_COLORS: Record<string, number> = {
  rabbit: 0xf5deb3,
  bird: 0x87ceeb,
  cat: 0xffa500,
  dog: 0x8b4513,
  fox: 0xff6347,
  owl: 0x4a3728,
  hedgehog: 0x808080,
}

export interface ArenaSceneData {
  units: ArenaUnit[]
  droppings: ArenaDropping[]
  coins: ArenaCoin[]
  onInteract: (id: string) => void
  onBoost: (id: string) => void
  onClean: (droppingId: string) => void
  onCollectCoin: (coinId: string) => void
  onPositionUpdate: (id: string, x: number, facing: 1 | -1) => void
  onTick: (elapsedMs: number, unitPositions: Record<string, number>) => void
}

export class ArenaScene extends Phaser.Scene {
  private units: ArenaUnit[] = []
  private droppings: ArenaDropping[] = []
  private coins: ArenaCoin[] = []
  private onInteract!: (id: string) => void
  private onBoost!: (id: string) => void
  private onClean!: (droppingId: string) => void
  private onCollectCoin!: (coinId: string) => void
  private onPositionUpdate!: (id: string, x: number, facing: 1 | -1) => void
  private onTick!: (elapsedMs: number, unitPositions: Record<string, number>) => void
  private sprites: Map<string, Phaser.GameObjects.Container> = new Map()
  private dropSprites: Map<string, Phaser.GameObjects.Ellipse> = new Map()
  private coinSprites: Map<string, Phaser.GameObjects.Arc> = new Map()
  private positionSyncAcc = 0
  private tickAcc = 0

  constructor() {
    super({ key: 'ArenaScene' })
  }

  init(data: ArenaSceneData) {
    this.units = data.units ?? []
    this.droppings = data.droppings ?? []
    this.coins = data.coins ?? []
    this.onInteract = data.onInteract ?? (() => {})
    this.onBoost = data.onBoost ?? (() => {})
    this.onClean = data.onClean ?? (() => {})
    this.onCollectCoin = data.onCollectCoin ?? (() => {})
    this.onPositionUpdate = data.onPositionUpdate ?? (() => {})
    this.onTick = data.onTick ?? (() => {})
  }

  create() {
    const w = this.scale.width
    const grass = this.add.rectangle(0, 0, w * 2, ARENA_HEIGHT, 0x2d5a27, 1)
    grass.setOrigin(0, 0)
    grass.setScrollFactor(0)
    this.add.existing(grass)

    const grassLine = this.add.rectangle(0, ARENA_HEIGHT - 4, w * 2, 4, 0x1e4620, 1)
    grassLine.setOrigin(0, 0)
    grassLine.setScrollFactor(0)
    this.add.existing(grassLine)

    this.units.forEach((a) => this.spawnUnit(a))
    this.droppings.forEach((d) => this.spawnDropping(d))
    this.coins.forEach((c) => this.spawnCoin(c))
  }

  update(_t: number, dt: number) {
    this.positionSyncAcc += dt
    const shouldSync = this.positionSyncAcc > 2000
    if (shouldSync) this.positionSyncAcc = 0

    this.tickAcc += dt
    if (this.tickAcc >= 2000) {
      const unitPositions: Record<string, number> = {}
      this.units.forEach((unit) => {
        const container = this.sprites.get(unit.id)
        if (container) unitPositions[unit.id] = container.x
      })
      this.onTick(this.tickAcc, unitPositions)
      this.tickAcc = 0
    }

    this.units.forEach((unit) => {
      const container = this.sprites.get(unit.id)
      if (!container) return

      const facing: 1 | -1 = container.scaleX >= 0 ? 1 : -1
      const speed = 20 + (unit.mood / 100) * 30
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
      if (shouldSync) this.onPositionUpdate(unit.id, nx, nextFacing)
    })
  }

  setArena(arena: { units: ArenaUnit[]; droppings: ArenaDropping[]; coins: ArenaCoin[] }) {
    const prevUnitIds = new Set(this.units.map((a) => a.id))
    const nextUnitIds = new Set(arena.units.map((a) => a.id))
    this.units = arena.units

    for (const unit of arena.units) {
      const container = this.sprites.get(unit.id)
      if (container) {
        container.setData('unit', unit)
      } else {
        this.spawnUnit(unit)
      }
    }

    for (const id of prevUnitIds) {
      if (!nextUnitIds.has(id)) {
        this.sprites.get(id)?.destroy()
        this.sprites.delete(id)
      }
    }

    const prevDroppingIds = new Set(this.droppings.map((d) => d.id))
    const nextDroppingIds = new Set(arena.droppings.map((d) => d.id))
    this.droppings = arena.droppings

    for (const d of arena.droppings) {
      if (!this.dropSprites.has(d.id)) {
        this.spawnDropping(d)
      }
    }
    for (const id of prevDroppingIds) {
      if (!nextDroppingIds.has(id)) {
        this.dropSprites.get(id)?.destroy()
        this.dropSprites.delete(id)
      }
    }

    const prevCoinIds = new Set(this.coins.map((c) => c.id))
    const nextCoinIds = new Set(arena.coins.map((c) => c.id))
    this.coins = arena.coins

    for (const c of arena.coins) {
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

  private spawnDropping(d: ArenaDropping) {
    const drop = this.add.ellipse(d.x, ARENA_HEIGHT / 2 + 14, 8, 5, 0x5c4033)
    drop.setStrokeStyle(1, 0x3d2b1f)
    drop.setDepth(2)
    drop.setInteractive(new Phaser.Geom.Ellipse(0, 0, 28, 20), Phaser.Geom.Ellipse.Contains)
    drop.setData('droppingId', d.id)
    const droppingId = d.id
    drop.on('pointerdown', () => {
      this.dropSprites.get(droppingId)?.destroy()
      this.dropSprites.delete(droppingId)
      this.onClean(droppingId)
    })
    this.dropSprites.set(d.id, drop)
  }

  private spawnCoin(c: ArenaCoin) {
    const coin = this.add.circle(c.x, ARENA_HEIGHT / 2 - 18, 6, 0xffd700)
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

  private spawnUnit(unit: ArenaUnit) {
    const color = UNIT_COLORS[unit.type] ?? 0xffffff
    const body = this.add.ellipse(0, 0, 24, 18, color)
    body.setStrokeStyle(2, 0x1a1a1a)

    const eye = this.add.circle(6, -2, 3, 0x000000)
    const container = this.add.container(unit.x, ARENA_HEIGHT / 2, [body, eye])
    container.setScale(unit.facing, 1)
    container.setDepth(1)

    container.setInteractive(
      new Phaser.Geom.Ellipse(0, 0, 48, 40),
      Phaser.Geom.Ellipse.Contains,
    )
    container.setData('unit', unit)

    container.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const u = container.getData('unit') as ArenaUnit
      if (ptr.rightButtonDown()) {
        this.onBoost(u.id)
      } else {
        this.onInteract(u.id)
      }
    })

    this.sprites.set(unit.id, container)
  }
}
