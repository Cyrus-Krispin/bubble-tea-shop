# Architecture Overview

## System shape

The application is a modular monolith:

```mermaid
flowchart LR
    UI["React SPA<br/>public, staff, owner, display routes"]
    API["Spring Boot<br/>modular monolith"]
    AUTH["Supabase<br/>managed authentication (planned)"]
    DB[("PostgreSQL<br/>local Compose today")]

    UI -->|"JSON over HTTPS<br/>generated OpenAPI client"| API
    UI -.->|"managed sign-in/session<br/>flow to be selected"| AUTH
    API -.->|"identity verification<br/>integration to be selected"| AUTH
    API --> DB
```

Spring is the only custom application backend. The React application does not introduce a Node
server at runtime or bypass Spring for domain operations. Supabase is the selected managed
authentication and data-service direction, but its exact boundary and local topology remain open.
PostgreSQL owns relational integrity; Spring owns workflows and server-side authorization.

## Backend modules

| Module | Responsibility | May depend on |
|---|---|---|
| `identity` | Supabase identity mapping, organizations, locations, accounts, memberships | shared infrastructure |
| `catalog` | Ingredients, recipes, products, variants, choices, offerings | identity identifiers |
| `inventory` | Balances, immutable movements, manual stock transactions | identity and catalog identifiers |
| `ordering` | Order snapshots, payments, status history, completion | identity, catalog, inventory |

Entities are persistence details and must not be returned directly from future controllers.
Cross-module changes go through application services rather than writing another module's tables
from controllers.

## Frontend direction

The future frontend is one React/TypeScript/Vite SPA:

- `app` owns routing and providers.
- `features` groups screens and behavior by backend domain.
- `design-system` owns tokens and accessible Radix-based components.
- TanStack Query owns server state; local UI state stays local.
- The API client is generated from Spring's OpenAPI document.

## Runtime configuration

- All timestamps are stored in UTC; location timezone is used at presentation/report boundaries.
- Supabase credentials and other secrets are environment-injected and never committed or seeded by
  Flyway.
- `ddl-auto=validate` ensures mappings match migrations without allowing Hibernate to alter schema.
- Local development currently uses PostgreSQL through Compose. A local or hosted Supabase
  development topology has not been selected.
