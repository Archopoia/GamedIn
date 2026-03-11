export const compliancePolicy = {
  /** MVP: manual. Roadmap: extension/bookmarklet for one-click or passive capture. */
  integrationMode: 'manual_only' as const,
  /** No bulk scraping. Capture only the job user is viewing (aligned with Huntr, JobPilot). */
  allowsPageContextCapture: true,
  allowsInvasiveAutomation: false,
  statement:
    'GamedIn records applications via manual log, one-click capture, or extension auto-detect. It does not submit applications for you or bulk-scrape job boards.',
}
