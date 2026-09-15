# Architecture Overview

## System shape

The application is a modular monolith:

```mermaid
flowchart LR
    UI["React SPA<br/>public, staff, owner, display routes"]
    API["Spring Boot<br/>modular monolith"]
    AUTH["Local Supabase Auth<br/>session and JWT issuer"]
    DB[("PostgreSQL<br/>local Compose today")]

    UI -->|"JSON over HTTPS<br/>generated OpenAPI client"| API
    UI -->|"sign-in and session lifecycle"| AUTH
    API -.->|"JWKS discovery<br/>private Compose network"| AUTH
    API --> DB
```

Spring is the only custom application backend. The React application does not introduce a Node
server at runtime or bypass Spring for domain operations. A self-hosted Supabase Auth service is
the local authentication issuer; it does not replace Spring or the application database.
PostgreSQL owns relational integrity; Spring owns workflows and server-side authorization.

## Backend modules

| Module | Responsibility | May depend on |
|---|---|---|
| `identity` | Supabase identity mapping, organizations, locations, accounts, memberships | shared infrastructure |
| `catalog` | Ingredients, recipes, products, variants, choices, offerings | identity identifiers |
| `inventory` | Balances, immutable movements, manual stock transactions, consumption forecasts and in-app shortage alerts | identity and catalog identifiers |
| `ordering` | Order snapshots, payments, status history, completion, operational paid expenses and cash-flow reporting | identity, catalog, inventory |

Entities are persistence details and are not returned directly from controllers.
Cross-module changes go through application services rather than writing another module's tables
from controllers.

## Frontend direction

The frontend is one React/TypeScript/Vite SPA:

- `app` owns routing and providers.
- `features` groups screens and behavior by backend domain.
- `components/ui` owns tokens and accessible Radix-based components.
- Guest catalog pages discover active locations, location-specific offerings, and prices from
  Spring. The cart remains bound to one location; TanStack Query remains planned for broader
  server-state caching.
- The API client is generated from Spring's OpenAPI document.

## Runtime configuration

- All timestamps are stored in UTC; location timezone is used at presentation/report boundaries.
- Supabase signing material and other secrets are environment-injected and never committed or
  seeded by Flyway.
- `ddl-auto=validate` ensures mappings match migrations without allowing Hibernate to alter schema.
- Local development uses PostgreSQL, Supabase Auth, its gateway, and Spring through Compose. The
  backend retrieves only public verification keys from the private network and uses no hosted
  Supabase service.

## Favorite pricing ownership

Ordering owns customer favorite preferences, checkout quotes and discount snapshots. It reads
identity and catalog records through its application service; controllers never update their tables.
The same pricing calculation serves quotes and placement. Customer IDs, discount percentages and
monetary values are never accepted from checkout clients.

## Currency configuration

Identity owns owner-only location creation. Catalog owns per-currency option pricing and its
readiness rule; ordering resolves those prices during placement. New shops start without offerings
or stock. Managers need an explicit location assignment through the existing owner team workflow.
The guest storefront uses an honest generic shop icon until location artwork is supplied.

Inventory owns manual-movement retry identities. Its application service authorizes each request,
claims the location-scoped key, compares the resolved actor and normalized payload, and returns an
existing immutable movement or records one new ledger mutation in the same transaction.
