export function computeLevel(totalApplications: number): number {
  return Math.max(1, Math.floor(totalApplications / 5) + 1)
}

export function computeUpgradeTier(level: number): number {
  if (level >= 10) {
    return 3
  }
  if (level >= 5) {
    return 2
  }
  return 1
}
