# GamedIn Widget App Workspace

This folder is the extension widget app workspace (TypeScript + React + Vite + PixiJS).
It builds the bundle consumed by `extension/widget/*`.

## Commands

- `npm run dev` - local widget development
- `npm run lint` - ESLint checks
- `npm run test` - Vitest with coverage
- `npm run test:e2e` - Playwright smoke tests
- `npm run build` - production widget bundle build

## Environment

Copy `.env.example` into `.env.local` and populate keys as needed.

## Extension Runtime

The `../extension` folder is the Chrome extension runtime. Load it unpacked from `chrome://extensions/`. When you apply on supported job sites, extension scripts store events that this widget app reads and renders.

## Compliance

No automated application submission. Extension captures only jobs you actively view/apply to (aligned with Huntr, JobPilot).

