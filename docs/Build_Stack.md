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

- **Manual:** Form and drag-to-pasture for non-LinkedIn or fallback.
- **Extension:** Chrome extension in `extension/`—passive detection of LinkedIn Easy Apply success, zero extra effort. Load unpacked from `chrome://extensions/`.
