# Product completion plan

The user authorized implementation and product decisions on 2026-09-15, superseding the initial
spec-only request. Deliver one focused implementation PR per missing story, stacking dependent
PRs so each diff remains reviewable. Preserve the earlier shadcn task files.

## Decisions

- Email is the login username for staff and customers. Keep local Supabase Auth and server-owned roles.
- The public storefront is Shop Display; reuse the existing shared component library.
- Keep session refresh; expire private state when the session cannot renew safely.
- Forecast fulfilled demand over up to 30 complete local days, report evidence/limited history.
- Use in-app projected alerts and a location-scoped reorder planning view.
- Cash flow counts actual paid cash events, not estimated purchase costs.
- One favorite recipe per organization, 5% base-price discount on one unit per order, server-owned.
- One settlement currency per location, supporting SGD/MYR/CNY; no FX conversion.
- English, Malay and Simplified Chinese cover shared UI and database-owned translated catalog content.
- Card provider: evaluate Stripe hosted checkout with a safe stock/payment lifecycle before enabling.
- Supplier API integration is explicitly excluded by the user. Existing manual receipt/adjustment UI is the chosen restocking workflow.

## Delivery and verification

- [x] Consumption forecasts: API, UI, calculation and scope tests; PR #35.
- [x] Projected low-stock alerts: visible in-app alerts and update behavior; PR #36.
- [x] Reorder planning: server-filtered prioritized list; PR #37.
- [x] Counter order entry: staff actor, guest ownership, pricing, idempotency, safe completion; PR #38.
- [x] Cash-flow reporting: outflow capture and 1/7/30-day summaries; PR #40.
- [x] Favorite recipe discount: ownership, deterministic pricing, immutable receipt; PR #42.
- [x] Multi-currency: location configuration and currency-specific option prices; PR #44.
- [ ] Localization: translated UI, catalog content, formatting and persistence.
- [x] Session expiry: safe refresh/expiry behavior and race tests; PR #39.
- [ ] Card checkout: hosted provider integration, event idempotency, stock/payment reconciliation.
- [x] Supplier restocking decision: user chose existing manual inventory UI; verify it during final review.
- [x] Staff retry safety: retain uncertain counter/expense drafts across token refresh; PR #41.
- [x] Intermediate subagent review: inventory refresh/pagination and staff retry recovery findings fixed and regression-tested.
- [ ] Subagent final audit across all 31 original stories; address findings and rerun affected checks.

For each increment: spec + code + meaningful tests, full affected Maven/frontend checks, real-browser
verification, reviewed diff, focused commit, push and PR. Regenerate OpenAPI/types for API changes.
Never declare a live external integration verified without its provider sandbox/live evidence.

- [x] Customer checkout recovery: preserve original attempt across routes, token changes and ambiguous errors; PR #43.

- [x] Final review follow-up: currency-correct reorder suggestions and availability; focused PR pending.
