# Projected low-stock alerts

Managers receive in-app warnings for stock exhausted now or projected to exhaust within seven days.
The seven-day lead horizon is a server-owned initial product policy. Alerts automatically refresh
once per minute while the inventory page is visible and on window focus. Unknown demand never
implies a reliable exhaustion date. Forecasts with less than 30 days of evidence are marked limited.

## Acceptance

- Server filtering happens before pagination. At most five ingredients appear in the summary,
  with a total matching the complete authorized location scope.
- Restocking resolves a warning on the next refresh. No stale warning is presented as current when
  refresh fails; unavailable alerts are explicit. Expired or revoked staff scope cannot read them.
- Alerts use the same forecast projection and fixed calculation snapshot as the forecast view.
- Use a persistent in-page notice rather than repeated toasts; no alert acknowledgment, external
  messaging, automatic purchase, or background browser notification is part of this first release.

Tests cover projected inclusion, restock resolution, unavailable state, and the responsive inventory
flow. Run backend `./mvnw verify` and frontend `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
and the inventory Playwright journey. See [forecast rules](ingredient-consumption-forecast.md).
