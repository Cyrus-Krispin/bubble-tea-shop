# Frontend

The frontend is a React, TypeScript, and Vite single-page application. The first implemented
screen is staff email/password sign-in through the local Supabase Auth gateway.

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

- `src/app/` — application shell and future routing/providers.
- `src/features/` — domain-oriented features, beginning with staff authentication.
- `src/design-system/` — future reusable component primitives and Storybook.

The browser talks to Supabase Auth only for session lifecycle. Future application data calls use
the generated Spring OpenAPI client; the browser must not call Supabase data APIs directly.

Self-service registration is disabled in the local Auth service. Staff accounts must be provisioned
by a later owner/bootstrap workflow; this screen intentionally supports sign-in only.

## Documentation

- [`docs/visual-style-guide.md`](docs/visual-style-guide.md) — selected visual direction for the
  customer ordering experience and its separation from staff operations.

The Docker image builds the SPA and serves it through Nginx on port 4173 with a health endpoint at
`/health`.
