# GamedIn Product Spec v0.1

## Core Loop

1. User logs a real application manually in-app.
2. System validates the input and emits `application_logged`.
3. Reward engine grants Zen currency and guest growth, then emits `reward_granted`.
4. Simulation updates progression and visuals.
5. State persists locally and can later sync to backend.

## Goals

- Make job search habit-forming with immediate positive feedback.
- Keep implementation legally safe for integration constraints.
- Preserve deterministic state and simple balancing knobs.

## Non-Goals (v0.1)

- No automated application submission.
- No scraping of external job platform content.
- No advanced economy complexity beyond one upgrade track.

## Events Dictionary

- `application_logged`: user submitted a manual apply log.
- `reward_granted`: Zen and guest changes applied.
- `upgrade_purchased`: user bought bath upgrade.

## Primary Balancing Inputs

- `qualityScore` (1-5)
- `streakDays` (capped contribution)
- `dailyRewardCap` fallback behavior
- `bathLevel` upgrade multiplier
