import type { ApplicationLog, SaveState, TelemetryEvent } from './types'

export type DomainEvent =
  | {
      type: 'application_logged'
      payload: {
        application: ApplicationLog
      }
    }
  | {
      type: 'reward_granted'
      payload: {
        pointsAwarded: number
        entityDelta: number
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
          totalApplications: state.progression.totalApplications,
        },
      }
    case 'reward_granted':
      return {
        name: event.type,
        timestamp: new Date().toISOString(),
        payload: {
          pointsAwarded: event.payload.pointsAwarded,
          entityDelta: event.payload.entityDelta,
          pointsBalance: state.economy.points,
        },
      }
    case 'upgrade_purchased':
      return {
        name: event.type,
        timestamp: new Date().toISOString(),
        payload: {
          upgrade: event.payload.upgrade,
          newLevel: event.payload.newLevel,
          pointsBalance: state.economy.points,
        },
      }
  }
}
