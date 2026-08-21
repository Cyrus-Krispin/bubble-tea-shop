# Frontend

The frontend is a React, TypeScript, and Vite single-page application. It contains customer cash
ordering, optional customer accounts, and authorized staff operations through the local Supabase
Auth gateway and Spring API.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm storybook
pnpm build-storybook
```

Vite listens on <http://localhost:5173> during direct development; the Compose Nginx frontend uses
<http://localhost:4173>. `VITE_SUPABASE_URL` defaults to the local Auth gateway at
`http://localhost:8000`; the Supabase client appends `/auth/v1`. `VITE_SUPABASE_ANON_KEY` is
optional with the current local gateway configuration; it is public client configuration, not a
secret or service-role credential.

## Structure

- `src/app/` — application routing, shared customer shell, and top-level providers.
- `src/features/` — domain-oriented authentication, catalog, customization, and current-order UI.
- `src/components/ui/` — reusable accessible interface primitives.
- `src/test/accessibility.ts` — shared axe-core WCAG test gate.
- `.storybook/` — React/Vite component catalog configuration.

The browser talks to Supabase Auth only for session lifecycle. Domain calls use same-origin Spring
endpoints under `/api/v1`; Nginx and the Vite development server proxy `/api` to the backend. The
browser must not call Supabase data APIs directly. API clients use generated immutable TypeScript
types from the committed Spring OpenAPI contract.

Self-service registration is enabled for customer accounts. After Supabase establishes a session,
the frontend calls Spring's authenticated, bodyless account-provisioning endpoint. Signup never
creates a role or organization membership. The first owner requires the one-shot bootstrap command;
owners can then grant, scope, deactivate, and reactivate registered manager accounts.

## Implemented routes

- `/` — customer welcome with `Continue as guest` and secondary staff access.
- `/shop` — responsive database-backed menu with category filters and sold-out treatment.
- `/shop/drinks/:drinkId` — accessible size, sweetness, ice, and topping customization.
- `/cart` — in-memory current-order review with quantity and removal controls.
- `/account/create` — optional customer email/password registration.
- `/account/sign-in` — customer sign-in and application-account provisioning.
- `/account` — session-aware customer account summary and sign-out.
- `/staff/sign-in` — existing staff authentication flow.
- `/staff` — server-scoped operations overview.
- `/staff/catalog/*` — ingredient, recipe, menu, variant, option-group, and choice management.
- `/staff/inventory` — current balances and immutable manual movement history.
- `/staff/orders` — authorized pending queue, detail, cash collection, and completion.
- `/staff/audit` — role-scoped operational audit timeline.
- `/staff/managers` — owner-only manager membership and location assignment management.

The customer routes fetch products, location, prices, availability, variants, option defaults, and
price deltas from Spring. Responses are validated before rendering, and failures show loading/error
states without a runtime fallback catalog. Cart totals remain previews until Spring validates the
submitted identifiers and returns the authoritative cash-order total. Ambiguous failures reuse the
same idempotency key so retries cannot create duplicate orders.

## Documentation

- [`docs/visual-style-guide.md`](docs/visual-style-guide.md) — selected visual direction for the
  customer ordering experience and its separation from staff operations.
- [`../docs/development/storybook.md`](../docs/development/storybook.md) — component documentation
  workflow and contribution rules.

The Docker image builds the SPA and serves it through Nginx on port 4173 with a health endpoint at
`/health`.
