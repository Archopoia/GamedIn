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

/**
 * Converts a domain event to a telemetry event for queuing.
 * Handles application_logged and reward_granted.
 */
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
  }
}
