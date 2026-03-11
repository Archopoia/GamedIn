import posthog from 'posthog-js'
import type { TelemetryEvent } from '../domain/types'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com'

let initialized = false

export function initAnalytics(): void {
  if (!POSTHOG_KEY || initialized) {
    return
  }
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
  })
  initialized = true
}

export function trackEvent(event: TelemetryEvent): void {
  if (!initialized || !POSTHOG_KEY) {
    return
  }
  posthog.capture(event.name, event.payload)
}
