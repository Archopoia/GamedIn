# GamedIn Product Spec v0.1

## Core Loop

1. User applies to a job (LinkedIn, Indeed, etc.) — **or** extension/bookmarklet auto-captures or one-click logs.
2. System validates the input and emits `application_logged`.
3. Reward engine grants Zen currency and guest growth, then emits `reward_granted`.
4. Simulation updates progression and visuals.
5. State persists locally and can later sync to backend.

## Goals

- Make job search habit-forming with immediate positive feedback.
- **Minimize player effort:** Hook to real application activity; extension/bookmarklet for zero or one-click capture (roadmap).
- Preserve deterministic state and simple balancing knobs.

## Non-Goals (v0.1)

- No automated application submission (we never submit for the user).
- No bulk scraping or data harvesting for resale.
- No advanced economy complexity beyond one upgrade track.

## Integration Roadmap

- **MVP:** Manual form (fastest to ship).
- **Next:** Extension or bookmarklet — one-click capture of job title/company from current page.
- **Later:** Passive detection — auto-detect apply confirmation, zero extra effort.

## Events Dictionary

- `application_logged`: user submitted an apply log (manual, one-click, or auto-captured).
- `reward_granted`: Zen and guest changes applied.
- `upgrade_purchased`: user bought bath upgrade.

## Primary Balancing Inputs

- `qualityScore` (1-5)
- `streakDays` (capped contribution)
- `dailyRewardCap` fallback behavior
- `bathLevel` upgrade multiplier
