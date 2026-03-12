import Phaser from 'phaser'
import type { ArenaOrb, ArenaDebris, ArenaEntity } from '../domain/types'

const ARENA_HEIGHT = 140
const VARIANT_COLORS: Record<string, number> = {
  a: 0xf5deb3,
  b: 0x87ceeb,
  c: 0xffa500,
  d: 0x8b4513,
  e: 0xff6347,
  f: 0x4a3728,
  g: 0x808080,
}

export interface ArenaSceneData {
  entities: ArenaEntity[]
  debris: ArenaDebris[]
  orbs: ArenaOrb[]
  onInteract: (id: string) => void
  onBoost: (id: string) => void
  onClearDebris: (debrisId: string) => void
  onCollectOrb: (orbId: string) => void
  onPositionUpdate: (id: string, x: number, facing: 1 | -1) => void
  onTick: (elapsedMs: number, entityPositions: Record<string, number>) => void
}

export class ArenaScene extends Phaser.Scene {
  private entities: ArenaEntity[] = []
  private debris: ArenaDebris[] = []
  private orbs: ArenaOrb[] = []
  private onInteract!: (id: string) => void
  private onBoost!: (id: string) => void
  private onClearDebris!: (debrisId: string) => void
  private onCollectOrb!: (orbId: string) => void
  private onPositionUpdate!: (id: string, x: number, facing: 1 | -1) => void
  private onTick!: (elapsedMs: number, entityPositions: Record<string, number>) => void
  private sprites: Map<string, Phaser.GameObjects.Container> = new Map()
  private debrisSprites: Map<string, Phaser.GameObjects.Ellipse> = new Map()
  private orbSprites: Map<string, Phaser.GameObjects.Arc> = new Map()
  private positionSyncAcc = 0
  private tickAcc = 0

  constructor() {
    super({ key: 'ArenaScene' })
  }

  init(data: ArenaSceneData) {
    this.entities = data.entities ?? []
    this.debris = data.debris ?? []
    this.orbs = data.orbs ?? []
    this.onInteract = data.onInteract ?? (() => {})
    this.onBoost = data.onBoost ?? (() => {})
    this.onClearDebris = data.onClearDebris ?? (() => {})
    this.onCollectOrb = data.onCollectOrb ?? (() => {})
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

    this.entities.forEach((a) => this.spawnEntity(a))
    this.debris.forEach((d) => this.spawnDebris(d))
    this.orbs.forEach((c) => this.spawnOrb(c))
  }

  update(_t: number, dt: number) {
    this.positionSyncAcc += dt
    const shouldSync = this.positionSyncAcc > 2000
    if (shouldSync) this.positionSyncAcc = 0

    this.tickAcc += dt
    if (this.tickAcc >= 2000) {
      const entityPositions: Record<string, number> = {}
      this.entities.forEach((entity) => {
        const container = this.sprites.get(entity.id)
        if (container) entityPositions[entity.id] = container.x
      })
      this.onTick(this.tickAcc, entityPositions)
      this.tickAcc = 0
    }

    this.entities.forEach((entity) => {
      const container = this.sprites.get(entity.id)
      if (!container) return

      const facing: 1 | -1 = container.scaleX >= 0 ? 1 : -1
      const speed = 20 + (entity.mood / 100) * 30
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
      if (shouldSync) this.onPositionUpdate(entity.id, nx, nextFacing)
    })
  }

  setArena(arena: { entities: ArenaEntity[]; debris: ArenaDebris[]; orbs: ArenaOrb[] }) {
    const prevEntityIds = new Set(this.entities.map((a) => a.id))
    const nextEntityIds = new Set(arena.entities.map((a) => a.id))
    this.entities = arena.entities

    for (const entity of arena.entities) {
      const container = this.sprites.get(entity.id)
      if (container) {
        container.setData('entity', entity)
      } else {
        this.spawnEntity(entity)
      }
    }

    for (const id of prevEntityIds) {
      if (!nextEntityIds.has(id)) {
        this.sprites.get(id)?.destroy()
        this.sprites.delete(id)
      }
    }

    const prevDebrisIds = new Set(this.debris.map((d) => d.id))
    const nextDebrisIds = new Set(arena.debris.map((d) => d.id))
    this.debris = arena.debris

    for (const d of arena.debris) {
      if (!this.debrisSprites.has(d.id)) {
        this.spawnDebris(d)
      }
    }
    for (const id of prevDebrisIds) {
      if (!nextDebrisIds.has(id)) {
        this.debrisSprites.get(id)?.destroy()
        this.debrisSprites.delete(id)
      }
    }

    const prevOrbIds = new Set(this.orbs.map((c) => c.id))
    const nextOrbIds = new Set(arena.orbs.map((c) => c.id))
    this.orbs = arena.orbs

    for (const c of arena.orbs) {
      if (!this.orbSprites.has(c.id)) {
        this.spawnOrb(c)
      }
    }
    for (const id of prevOrbIds) {
      if (!nextOrbIds.has(id)) {
        this.orbSprites.get(id)?.destroy()
        this.orbSprites.delete(id)
      }
    }
  }

  private spawnDebris(d: ArenaDebris) {
    const drop = this.add.ellipse(d.x, ARENA_HEIGHT / 2 + 14, 8, 5, 0x5c4033)
    drop.setStrokeStyle(1, 0x3d2b1f)
    drop.setDepth(2)
    drop.setInteractive(new Phaser.Geom.Ellipse(0, 0, 28, 20), Phaser.Geom.Ellipse.Contains)
    drop.setData('debrisId', d.id)
    const debrisId = d.id
    drop.on('pointerdown', () => {
      this.debrisSprites.get(debrisId)?.destroy()
      this.debrisSprites.delete(debrisId)
      this.onClearDebris(debrisId)
    })
    this.debrisSprites.set(d.id, drop)
  }

  private spawnOrb(c: ArenaOrb) {
    const orb = this.add.circle(c.x, ARENA_HEIGHT / 2 - 18, 6, 0xffd700)
    orb.setStrokeStyle(1, 0xb8860b)
    orb.setDepth(2)
    orb.setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains)
    orb.setData('orbId', c.id)
    const orbId = c.id
    orb.on('pointerdown', () => {
      this.orbSprites.get(orbId)?.destroy()
      this.orbSprites.delete(orbId)
      this.onCollectOrb(orbId)
    })
    this.orbSprites.set(c.id, orb)
  }

  private spawnEntity(entity: ArenaEntity) {
    const color = VARIANT_COLORS[entity.variant] ?? 0xffffff
    const body = this.add.ellipse(0, 0, 24, 18, color)
    body.setStrokeStyle(2, 0x1a1a1a)

    const eye = this.add.circle(6, -2, 3, 0x000000)
    const container = this.add.container(entity.x, ARENA_HEIGHT / 2, [body, eye])
    container.setScale(entity.facing, 1)
    container.setDepth(1)

    container.setInteractive(
      new Phaser.Geom.Ellipse(0, 0, 48, 40),
      Phaser.Geom.Ellipse.Contains,
    )
    container.setData('entity', entity)

    container.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const u = container.getData('entity') as ArenaEntity
      if (ptr.rightButtonDown()) {
        this.onBoost(u.id)
      } else {
        this.onInteract(u.id)
      }
    })

    this.sprites.set(entity.id, container)
  }
}
