export type ApplicationSource = 'linkedin' | 'indeed' | 'glassdoor' | 'other'

export type SpinOutcome = 'ghosted' | 'rejected' | 'interview' | 'offer'
export type EnemyType =
  | 'ghosted'
  | 'rejection'
  | 'fake_job'
  | 'ats_filter'
  | 'rent_due'
  | 'despair'
export type WeaponId = string
export type UpgradeId = string

export interface Profile {
  displayName: string
  preferredRoles: string[]
  dailyApplyGoal: number
}

export interface ApplicationLog {
  id: string
  title: string
  company: string
  source: ApplicationSource
  qualityScore: 1 | 2 | 3 | 4 | 5
  createdAt: string
}

export interface CopePet {
  id: string
  mood: number
  lastFedAt: string
}

export interface ArenaEnemy {
  id: string
  type: EnemyType
  x: number
  y: number
  targetX: number
  targetY: number
  hp: number
}

export interface ArenaWeapon {
  id: string
  weaponId: WeaponId
  x: number
  lastFiredAt: number
}

export interface ArenaProjectile {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  targetEnemyId: string
}

export interface ArenaState {
  pet: CopePet
  enemies: ArenaEnemy[]
  weapons: ArenaWeapon[]
  projectiles: ArenaProjectile[]
  lastSpawnAt?: number
}

export interface RunState {
  appliesToday: number
  dayKey: string
  completed: boolean
}

export interface SpinResult {
  outcome: SpinOutcome
  hopiumAwarded: number
  timestamp: string
}

export interface UpgradeOption {
  id: UpgradeId
  label: string
  type: 'weapon' | 'passive' | 'stat'
}

export interface MetaState {
  achievements: string[]
  collectibles: string[]
  totalRunsCompleted: number
  gotOfferReceived?: boolean
}

export interface TelemetryEvent {
  name: string
  timestamp: string
  payload: Record<string, string | number | boolean>
}

export interface SaveState {
  profile: Profile
  applications: ApplicationLog[]
  economy: { hopium: number; totalHopiumEarned: number }
  engagement: { streakDays: number; lastApplyDate: string | null }
  run: RunState
  arena: ArenaState
  meta: MetaState
  telemetryQueue: TelemetryEvent[]
  pendingSpin: SpinResult | null
  pendingUpgradeOptions: UpgradeOption[] | null
  pendingBonusSpin: SpinResult | null
}
