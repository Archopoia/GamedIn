export type ApplicationSource = 'linkedin' | 'indeed' | 'glassdoor' | 'other'

export type UnitType =
  | 'rabbit'
  | 'bird'
  | 'cat'
  | 'dog'
  | 'fox'
  | 'owl'
  | 'hedgehog'

export interface ArenaUnit {
  id: string
  type: UnitType
  mood: number
  lastBoostedAt: string | null
  lastInteractedAt: string | null
  x: number
  facing: 1 | -1
  coinAccumulated: number
}

export interface ArenaDropping {
  id: string
  x: number
  unitId: string
}

export interface ArenaCoin {
  id: string
  x: number
  amount: number
  unitId: string
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
  units: ArenaUnit[]
  droppings: ArenaDropping[]
  coins: ArenaCoin[]
  unlockedTypes: UnitType[]
  arenaLevel: number
}

export interface TelemetryEvent {
  name: string
  timestamp: string
  payload: Record<string, string | number | boolean>
}

export interface SaveStateV1 {
  version: 1
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
