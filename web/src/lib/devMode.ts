/**
 * Dev mode is active when running `npm run dev` (Vite sets import.meta.env.DEV).
 * Can be overridden via VITE_DEV_MODE=true in .env for preview builds.
 */
export const isDevMode =
  import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true'
