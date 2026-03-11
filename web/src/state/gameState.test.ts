import { describe, expect, it } from 'vitest'
import {
  applyLoggedCommand,
  createInitialState,
  purchaseBathUpgrade,
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
    expect(result.state.economy.zen).toBeGreaterThan(0)
    expect(result.events.map((event) => event.type)).toEqual([
      'application_logged',
      'reward_granted',
    ])
  })

  it('supports upgrade purchases from zen balance', () => {
    const seeded = {
      ...createInitialState(),
      economy: {
        zen: 300,
        totalZenEarned: 300,
      },
    }
    const result = purchaseBathUpgrade(seeded)
    expect(result.event?.type).toBe('upgrade_purchased')
    expect(result.state.upgrades.bathLevel).toBe(2)
    expect(result.state.economy.zen).toBeLessThan(300)
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
