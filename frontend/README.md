# Frontend

The React/Vite application is intentionally deferred until the schema foundation is stable.
Its planned structure is:

- `src/app/` — routing, providers, and public/staff/owner/display layouts.
- `src/features/` — domain-oriented UI features.
- `src/design-system/` — Tailwind tokens, Radix-based components, and Storybook stories.

The API client will be generated from the backend OpenAPI document.

## Documentation

- [`docs/visual-style-guide.md`](docs/visual-style-guide.md) — selected visual direction for the
  customer ordering experience and its separation from staff operations.

Until that application exists, `server.mjs` provides only a health endpoint and an explicit JSON
placeholder so the complete local Docker stack can start without pretending that product UI has
been implemented.
