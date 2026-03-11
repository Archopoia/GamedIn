# GamedIn Web MVP

Web-first MVP implementing the GamedIn kickoff plan:

- React + Vite + TypeScript app shell
- Phaser simulation panel for cozy onsen feedback
- Manual application logging command flow
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

## Compliance

This MVP intentionally does not scrape job platforms or automate applications.
Only manual self-reported application logs are used.

