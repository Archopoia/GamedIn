export type ApplicationSource = 'linkedin' | 'indeed' | 'glassdoor' | 'other'

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
  telemetryQueue: TelemetryEvent[]
}
