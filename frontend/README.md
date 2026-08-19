# Frontend

The frontend is a React, TypeScript, and Vite single-page application. It contains a customer-first
guest ordering preview and staff email/password sign-in through the local Supabase Auth gateway.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Vite listens on <http://localhost:4173>. `VITE_SUPABASE_URL` defaults to the local Auth gateway at
`http://localhost:8000`; the Supabase client appends `/auth/v1`. `VITE_SUPABASE_ANON_KEY` is optional with the current local
gateway configuration; it is a public client configuration value, not a secret or service-role
credential.

## Structure

- `src/app/` — application routing, shared customer shell, and top-level providers.
- `src/features/` — domain-oriented authentication, catalog, customization, and current-order UI.
- `src/design-system/` — future reusable component primitives and Storybook.

The browser talks to Supabase Auth only for session lifecycle. Guest catalog calls use same-origin
Spring endpoints under `/api/v1/guest`; Nginx and the Vite development server proxy `/api` to the
backend. The browser must not call Supabase data APIs directly. OpenAPI client generation remains a
later contract-tooling increment.

Self-service registration is disabled in the local Auth service. Staff accounts must be provisioned
by a later owner/bootstrap workflow; this screen intentionally supports sign-in only.

## Implemented routes

- `/` — customer welcome with `Continue as guest` and secondary staff access.
- `/shop` — responsive database-backed menu with category filters and sold-out treatment.
- `/shop/drinks/:drinkId` — accessible size, sweetness, ice, and topping customization.
- `/cart` — in-memory current-order review with quantity and removal controls.
- `/staff/sign-in` — existing staff authentication flow.

The customer routes fetch products, location, prices, availability, variants, option defaults, and
price deltas from Spring. Responses are validated before rendering, and failures show loading/error
states without a runtime fallback catalog. Cart totals remain previews, checkout is disabled, and
no order or inventory reservation is created until the guest ordering API exists.

## Documentation

- [`docs/visual-style-guide.md`](docs/visual-style-guide.md) — selected visual direction for the
  customer ordering experience and its separation from staff operations.

The Docker image builds the SPA and serves it through Nginx on port 4173 with a health endpoint at
`/health`.
