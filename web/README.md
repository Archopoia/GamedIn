# GamedIn Web MVP

Web-first MVP implementing the GamedIn kickoff plan:

- React + Vite + TypeScript app shell
- Phaser simulation panel for gamification feedback
- Chrome extension for full automation—detects LinkedIn Easy Apply success, zero manual input
- Reward engine with streaks, daily caps, and upgrades
- Deterministic local persistence with versioned save model
- Optional Supabase and PostHog integration hooks

## Commands

- `npm run dev` - local development
- `npm run lint` - ESLint checks
- `npm run test` - Vitest with coverage
- `npm run test:e2e` - Playwright smoke tests
- `npm run build` - production build

## Environment

Copy `.env.example` into `.env.local` and populate keys as needed.

## Extension

The `../extension` folder contains a Chrome extension for zero-effort tracking. Load it unpacked from `chrome://extensions/`. When you Easy Apply on LinkedIn, it auto-detects success and sends the job to GamedIn. See `../extension/README.md`.

## Compliance

No automated application submission. Extension captures only the job you are viewing when you apply (aligned with Huntr, JobPilot). Full automation—no manual form.

