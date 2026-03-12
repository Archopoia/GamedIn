import { describe, expect, it } from 'vitest'
import {
  applyLoggedCommand,
  confirmSpin,
  createInitialState,
  selectUpgrade,
  upsertProfile,
} from './gameState'
import {
  restoreStateFromString,
  serializeState,
} from '../widget/storage'

describe('gameState vertical slice', () => {
  it('logs application and grants reward with spin and upgrade', () => {
    const state = createInitialState()
    const result = applyLoggedCommand(state, {
      title: 'Frontend Engineer',
      company: 'Acme',
      source: 'linkedin',
      qualityScore: 5,
    })

    expect(result.state.applications).toHaveLength(1)
    expect(result.state.economy.hopium).toBeGreaterThan(0)
    expect(result.state.pendingSpin).toBeTruthy()
    expect(result.state.pendingUpgradeOptions).toHaveLength(3)
    expect(result.events.map((event) => event.type)).toEqual([
      'application_logged',
      'reward_granted',
    ])
  })

  it('confirmSpin clears pendingSpin', () => {
    const state = createInitialState()
    const afterApply = applyLoggedCommand(state, {
      title: 'Dev',
      company: 'Corp',
      source: 'linkedin',
      qualityScore: 3,
    }).state
    expect(afterApply.pendingSpin).toBeTruthy()

    const afterConfirm = confirmSpin(afterApply)
    expect(afterConfirm.pendingSpin).toBeNull()
  })

  it('selectUpgrade clears pendingUpgradeOptions and adds weapon', () => {
    const state = createInitialState()
    const afterApply = applyLoggedCommand(state, {
      title: 'Dev',
      company: 'Corp',
      source: 'linkedin',
      qualityScore: 3,
    }).state
    const options = afterApply.pendingUpgradeOptions ?? []
    expect(options.length).toBeGreaterThan(0)

    const afterSelect = selectUpgrade(afterApply, options[0]!.id)
    expect(afterSelect.pendingUpgradeOptions).toBeNull()
  })

  it('restores deterministic save payload', () => {
    const withProfile = upsertProfile(createInitialState(), {
      displayName: 'Hullivan',
      preferredRoles: ['Frontend Engineer'],
      dailyApplyGoal: 4,
    })
    const serialized = serializeState(withProfile)
    const restored = restoreStateFromString(serialized)
    expect(restored.profile).toEqual(withProfile.profile)
    expect(restored.economy.hopium).toBe(withProfile.economy.hopium)
    expect(restored.arena.pet.id).toBe(withProfile.arena.pet.id)
  })
})
