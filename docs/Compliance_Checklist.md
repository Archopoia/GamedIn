# GamedIn Compliance Checklist

## Opportunity-Aligned Guardrails

We maximize integration opportunity within proven market patterns (Huntr, LinkedIn Job Application Tracker, JobPilot, Teal). These apps auto-capture job data from LinkedIn and operate successfully. We follow the same approach.

## Do

- **Extension / bookmarklet capture:** Read job title and company from the page the user is viewing when they apply. Same pattern as existing job trackers.
- **Passive detection:** Detect apply confirmation via DOM observation or URL/state changes. No bulk scraping.
- **Optional badges:** Lightweight "Logged" or "Applied" indicators on job cards—aligned with LinkedIn Job Tracker, Huntr.
- **Separate game window:** Main game UI lives in its own window/tab, not injected into LinkedIn.
- **Transparent data:** User knows what we collect; limited to game progression and job context for rewards.
- **User consent:** Extension install and integrations are explicit opt-in.
- **Optional analytics:** Controlled via environment configuration.

## Don't

- **No automated application submission.** We never click Apply or submit applications for the user.
- **No bulk scraping.** We capture only the job the user is actively viewing/applying to, not crawling or harvesting at scale.
- **No invasive automation.** No bots, no automated form filling on job sites.
- **No resale of data.** Job context is used only for in-game rewards and user's own tracking.

## Future Integrations

- Require explicit user consent.
- Prefer official APIs where available (e.g., Indeed).
- For LinkedIn: extension/bookmarklet capture aligns with what the market already does.
