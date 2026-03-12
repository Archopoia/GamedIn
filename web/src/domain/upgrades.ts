import type { UpgradeOption } from './types'

const UPGRADE_POOL: UpgradeOption[] = [
  { id: 'easy_apply', label: 'Easy Apply', type: 'weapon' },
  { id: 'tailored_resume', label: 'Tailored Resume', type: 'weapon' },
  { id: 'cover_letter', label: 'Cover Letter', type: 'weapon' },
  { id: 'respect_aura', label: 'Respect Aura', type: 'passive' },
  { id: 'copium_shield', label: 'Copium Shield', type: 'passive' },
  { id: 'hopium_boost', label: '+10% Hopium', type: 'stat' },
  { id: 'rejection_resist', label: 'Rejection Resist', type: 'passive' },
  { id: 'ghost_radar', label: 'Ghost Radar', type: 'weapon' },
]

export function getRandomUpgradeOptions(count = 3): UpgradeOption[] {
  const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
