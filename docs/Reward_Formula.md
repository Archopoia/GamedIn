# Reward Formula (MVP)

Zen reward formula:

`zen = round(10 * qualityMultiplier * upgradeBonus + streakBonus)`

Where:

- `qualityMultiplier = 1 + (qualityScore - 1) * 0.15`
- `upgradeBonus = 1 + bathLevel * 0.1`
- `streakBonus = min(streakDays, 14)`

Daily cap behavior:

- For apply attempts beyond `dailyRewardCap`, rewards are reduced to `max(2, round(zen * 0.2))`.

Guest growth:

- `qualityScore >= 4` grants 2 guests.
- Otherwise grants 1 guest.

Tuning constants can be changed in `src/domain/reward.ts`.
