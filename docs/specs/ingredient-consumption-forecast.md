# Ingredient consumption forecast

## Story and decision

Managers can view estimated daily consumption and days of stock remaining at each assigned location.
Use fulfilled SALE movements over up to 30 complete location-calendar days, excluding today.
Begin observations on the first full day after both the location and ingredient existed. Include
zero-sale days. Early estimates are explicitly marked as limited history. This estimates observed
fulfilled demand, which can understate demand when stockouts prevent sales.

## Contract

- Add a bounded, paginated `GET .../inventory/forecasts` under the existing authorized staff scope.
- Return base-unit quantity, exact decimal-string daily consumption, days remaining, observation
  days, status, threshold, and calculation timestamp; never accept client rates or balances.
- Zero balance is OUT_OF_STOCK. Positive balance without a complete observation day is
  INSUFFICIENT_HISTORY. Positive balance with zero consumption is NO_OBSERVED_DEMAND.
- Current balances and sales history come from a repeatable-read snapshot. Pending orders,
  openings, receipts, adjustments, and reversals do not count as fulfilled demand.
- Inventory UI loads forecasts on request and shows unknown values explicitly. Forecasts do not
  reserve stock, promise availability, or change inventory.

## Acceptance and verification

- 300 units sold over 30 days with 50 remaining produces 10/day and five days remaining.
- Unauthorized locations and oversized pages are rejected; new history and zero stock are distinct.
- PostgreSQL integration tests cover aggregation, state, and scope. Frontend tests cover response
  validation, loading, errors, and results. Run `cd backend && ./mvnw verify` and, from `frontend`,
  `pnpm test && pnpm typecheck && pnpm lint && pnpm build`; verify the inventory view in a browser.

Use existing inventory ownership, generated OpenAPI types and shared components. No schema change
is required. Follow [inventory lifecycle](../product/inventory-management.md) and
[security](../architecture/security.md). Project-wide delivery remains tracked in
[product completion](../../tasks/product-completion-plan.md).
