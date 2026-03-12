import type { ApplicationLog, SaveState, TelemetryEvent } from './types'

export type DomainEvent =
  | {
      type: 'application_logged'
      payload: { application: ApplicationLog }
    }
  | {
      type: 'reward_granted'
      payload: {
        hopiumAwarded: number
        outcome: string
      }
    }
  | {
      type: 'upgrade_purchased'
      payload: {
        upgrade: 'facility'
        newLevel: number
      }
    }

export function toTelemetryEvent(
  event: DomainEvent,
  state: SaveState,
): TelemetryEvent {
  switch (event.type) {
    case 'application_logged':
      return {
        name: event.type,
        timestamp: new Date().toISOString(),
        payload: {
          source: event.payload.application.source,
          qualityScore: event.payload.application.qualityScore,
          totalApplications: state.applications.length,
        },
      }
    case 'reward_granted':
      return {
        name: event.type,
        timestamp: new Date().toISOString(),
        payload: {
          hopiumAwarded: event.payload.hopiumAwarded,
          outcome: event.payload.outcome,
          hopiumBalance: state.economy.hopium,
        },
      }
    case 'upgrade_purchased':
      return {
        name: event.type,
        timestamp: new Date().toISOString(),
        payload: {
          upgrade: event.payload.upgrade,
          newLevel: event.payload.newLevel,
          hopiumBalance: state.economy.hopium,
        },
      }
  }
}
