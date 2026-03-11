# GamedIn Product Spec v0.1

## Core Loop

1. User applies to a job on LinkedIn (Easy Apply).
2. Extension auto-detects success and sends job title/company to the game.
3. System validates the input and emits `application_logged`.
4. Reward engine grants Zen currency and guest growth, then emits `reward_granted`.
5. Simulation updates progression and visuals.
6. State persists locally and can later sync to backend.

## Goals

- Make job search habit-forming with immediate positive feedback.
- **Full automation:** Zero extra effort. Extension is the only input path.
- Preserve deterministic state and simple balancing knobs.

## Non-Goals (v0.1)

- No manual form or drag-to-pasture.
- No automated application submission (we never submit for the user).
- No bulk scraping or data harvesting for resale.
- No advanced economy complexity beyond one upgrade track.

## Integration

- **Extension only:** Chrome extension detects LinkedIn Easy Apply success and auto-captures job title/company. No manual logging.

## Events Dictionary

- `application_logged`: extension auto-captured apply from LinkedIn.
- `reward_granted`: Zen and guest changes applied.
- `upgrade_purchased`: user bought bath upgrade.

## Primary Balancing Inputs

- `qualityScore` (1-5)
- `streakDays` (capped contribution)
- `dailyRewardCap` fallback behavior
- `bathLevel` upgrade multiplier
