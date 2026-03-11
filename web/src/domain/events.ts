import type { ApplicationLog, SaveStateV1, TelemetryEvent } from './types'

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
        zenAwarded: number
        guestDelta: number
      }
    }
  | {
      type: 'upgrade_purchased'
      payload: {
        upgrade: 'bath'
        newLevel: number
      }
    }

export function toTelemetryEvent(
  event: DomainEvent,
  state: SaveStateV1,
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
          zenAwarded: event.payload.zenAwarded,
          guestDelta: event.payload.guestDelta,
          zenBalance: state.economy.zen,
        },
      }
    case 'upgrade_purchased':
      return {
        name: event.type,
        timestamp: new Date().toISOString(),
        payload: {
          upgrade: event.payload.upgrade,
          newLevel: event.payload.newLevel,
          zenBalance: state.economy.zen,
        },
      }
  }
}
