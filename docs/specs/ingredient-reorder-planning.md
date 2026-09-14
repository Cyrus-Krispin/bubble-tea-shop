# Ingredient reorder planning

Managers can open a prioritized reorder list for the selected authorized location. This is a
purchasing aid; the user explicitly chose manual receipts/adjustments instead of supplier integration.

## Rules and acceptance

- Include empty ingredients, ingredients at/below their configured threshold, and ingredients
  projected to exhaust within seven days. Filter on the server before pagination.
- Prioritize empty stock, then earliest finite exhaustion, then threshold-only unknown estimates;
  use ingredient name and ID for deterministic ties.
- Explain each inclusion: empty, quantity threshold, projection, or both. Show units, on-hand
  quantity, demand estimate, history length, and days remaining; unknown demand stays unknown.
- Refresh after receipts or adjustments; never submit a supplier purchase or mutate balances from
  this read-only view. Empty, loading, unavailable, and inaccessible states must be explicit.
- Tests prove that a safe first ingredient cannot hide later qualifying items on a bounded page,
  and that threshold-only ingredients qualify even without historical demand.

Uses the existing [forecast projection](ingredient-consumption-forecast.md) and inventory module.
Run backend `./mvnw verify`; frontend `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and
browser inventory tests at desktop/mobile sizes. No new stored entities are required.
