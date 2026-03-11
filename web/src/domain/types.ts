export type ApplicationSource = 'linkedin' | 'indeed' | 'glassdoor' | 'other'

export type CritterType =
  | 'rabbit'
  | 'bird'
  | 'cat'
  | 'dog'
  | 'fox'
  | 'owl'
  | 'hedgehog'

export interface PastureAnimal {
  id: string
  type: CritterType
  mood: number
  lastFedAt: string | null
  lastPettedAt: string | null
  x: number
  facing: 1 | -1
  coinAccumulated: number
}

export interface PastureDropping {
  id: string
  x: number
  animalId: string
}

export interface PastureCoin {
  id: string
  x: number
  amount: number
  animalId: string
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
  zen: number
  totalZenEarned: number
}

export interface GuestState {
  active: number
  happiestGuestMood: number
}

export interface ProgressionState {
  level: number
  totalApplications: number
  unlockedBathTier: number
}

export interface EngagementState {
  streakDays: number
  lastApplyDate: string | null
  appliesToday: number
  appliesDayKey: string
  dailyRewardCap: number
}

export interface UpgradeState {
  bathLevel: number
  bathUpgradeCost: number
}

export interface PastureState {
  animals: PastureAnimal[]
  droppings: PastureDropping[]
  coins: PastureCoin[]
  unlockedCritters: CritterType[]
  pastureLevel: number
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
  guests: GuestState
  progression: ProgressionState
  engagement: EngagementState
  upgrades: UpgradeState
  pasture?: PastureState
  telemetryQueue: TelemetryEvent[]
}
