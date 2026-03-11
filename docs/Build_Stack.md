# GamedIn Default Build Stack

This file confirms the implementation stack selected for the initial GamedIn build.

- App platform: Web-first
- Frontend: React + Vite + TypeScript
- Game surface: Phaser 3 embedded inside React
- Validation/contracts: Zod + shared domain types
- Backend target: Supabase (Auth + Postgres + RLS)
- Analytics: PostHog (optional via env), fallback event queue
- Testing: Vitest + Playwright
- Quality tooling: ESLint + Prettier + Husky + lint-staged + GitHub Actions

## Integration Strategy

- **MVP:** Manual self-reporting for applications (fastest path to ship).
- **Roadmap:** Chrome extension or bookmarklet for one-click capture of job title/company from the current page—aligned with proven market patterns (Huntr, LinkedIn Job Application Tracker, JobPilot).
- **Target:** Passive detection for zero extra effort; extension auto-detects apply confirmation and grants rewards.
