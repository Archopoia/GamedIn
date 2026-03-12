import { describe, expect, it } from 'vitest'
import {
  applyLoggedCommand,
  createInitialState,
  purchaseUpgrade,
  upsertProfile,
} from './gameState'
import { restoreState, serializeState } from './saveSync'

describe('gameState vertical slice', () => {
  it('logs application and grants reward', () => {
    const state = createInitialState()
    const result = applyLoggedCommand(state, {
      title: 'Frontend Engineer',
      company: 'Acme',
      source: 'linkedin',
      qualityScore: 5,
    })

    expect(result.state.applications).toHaveLength(1)
    expect(result.state.economy.points).toBeGreaterThan(0)
    expect(result.events.map((event) => event.type)).toEqual([
      'application_logged',
      'reward_granted',
    ])
  })

  it('supports upgrade purchases from points balance', () => {
    const seeded = {
      ...createInitialState(),
      economy: {
        points: 300,
        totalPointsEarned: 300,
      },
    }
    const result = purchaseUpgrade(seeded)
    expect(result.event?.type).toBe('upgrade_purchased')
    expect(result.state.upgrades.upgradeLevel).toBe(2)
    expect(result.state.economy.points).toBeLessThan(300)
  })

  it('restores deterministic save payload', () => {
    const withProfile = upsertProfile(createInitialState(), {
      displayName: 'Hullivan',
      preferredRoles: ['Frontend Engineer'],
      dailyApplyGoal: 4,
    })
    const serialized = serializeState(withProfile)
    const restored = restoreState(serialized)
    expect(restored).toEqual(withProfile)
  })
})
