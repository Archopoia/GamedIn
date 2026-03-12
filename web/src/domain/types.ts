export type ApplicationSource = 'linkedin' | 'indeed' | 'glassdoor' | 'other'

export type EntityVariant = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'

export interface ArenaEntity {
  id: string
  variant: EntityVariant
  mood: number
  lastBoostedAt: string | null
  lastInteractedAt: string | null
  x: number
  facing: 1 | -1
  orbAccumulated: number
}

export interface ArenaDebris {
  id: string
  x: number
  entityId: string
}

export interface ArenaOrb {
  id: string
  x: number
  amount: number
  entityId: string
}

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

export interface EconomyState {
  points: number
  totalPointsEarned: number
}

export interface UnitState {
  active: number
  happiestMood: number
}

export interface ProgressionState {
  level: number
  totalApplications: number
  unlockedUpgradeTier: number
}

export interface EngagementState {
  streakDays: number
  lastApplyDate: string | null
  appliesToday: number
  appliesDayKey: string
  dailyRewardCap: number
}

export interface UpgradeState {
  upgradeLevel: number
  upgradeCost: number
}

export interface ArenaState {
  entities: ArenaEntity[]
  debris: ArenaDebris[]
  orbs: ArenaOrb[]
  unlockedVariants: EntityVariant[]
  arenaLevel: number
}

export interface TelemetryEvent {
  name: string
  timestamp: string
  payload: Record<string, string | number | boolean>
}

export interface SaveState {
  profile: Profile
  applications: ApplicationLog[]
  economy: EconomyState
  units: UnitState
  progression: ProgressionState
  engagement: EngagementState
  upgrades: UpgradeState
  arena?: ArenaState
  telemetryQueue: TelemetryEvent[]
}
