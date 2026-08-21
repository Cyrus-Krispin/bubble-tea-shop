# Technology Stack and Rationale

Bubble Tea Shop uses a deliberately familiar backend stack and a flexible frontend stack. The goal
is to spend less time experimenting with infrastructure and more time on the ordering experience,
shop workflows, and user interface. This document distinguishes the local runtime that is now
implemented from choices that remain planned for later delivery phases.

## Frontend

The frontend is a single React application written in TypeScript and built with Vite.
React and TypeScript provide enough flexibility to support the public menu, staff workflows, owner
administration, and display views without introducing separate frontend applications. Vite keeps
the development loop lightweight, while pnpm manages the workspace on Node.js.

Tailwind CSS is the intended styling approach because it makes UI iteration fast and works well
with AI-assisted implementation. The first reusable interface layer now provides buttons, fields,
tables, dialogs, pagination, and problem states; Radix supplies the dialog's focus and modal
behavior. TanStack Query remains planned for server state, while Vitest interaction tests are the
current executable component contract. The frontend consumes Spring APIs through `openapi-fetch`
using types generated from the committed Spring OpenAPI contract, so API changes remain visible
during verification and compilation.

The frontend now contains the React, TypeScript, and Vite foundation, declarative client-side
routing, separate customer and staff authentication routes that use the local Supabase Auth
gateway, and a guest ordering preview. The guest menu and customization routes load catalog,
availability, prices, and options from Spring. The current order remains in memory and checkout
stays disabled until Spring owns order placement and final total calculation. It includes linting,
type checking, Vitest component tests, and a containerized SPA build.
Tailwind and TanStack Query remain selected choices for later increments. Storybook is deferred
until isolated visual review adds value beyond the smaller component test suite.

## Backend and API

The backend is a Java 21 application built with Spring Boot 4.1 and Maven. Java and Spring Boot are
the developer's strongest and most familiar backend technologies. Choosing them avoids making the
backend an experiment and leaves more attention for user experience and frontend quality.

The application is a modular monolith organized around identity, catalog, inventory, and ordering.
This keeps deployment and local development simple while allowing inventory and order completion
to share a strongly consistent transaction. Spring Data JPA and Hibernate map the domain data,
while focused workflow services can use Spring JDBC when explicit locking and SQL make transaction
behavior clearer. Spring Validation, Spring Security, OAuth 2.0 resource-server support, Spring
Web, and Actuator are present in the current Maven foundation. Supabase now supersedes the earlier
custom Spring password and session plan; Spring Security implements the bearer-token verification
boundary for the local Auth issuer.

The implemented controllers return purpose-built DTOs rather than persistence entities. Springdoc
generates an OpenAPI 3.1 document for contract verification, but publication is disabled by default
at runtime. A committed snapshot and generated immutable TypeScript types make backend-to-frontend
contract drift fail verification.

## Data and authentication

PostgreSQL is the system of record. The expected data model is well understood and relational:
organizations, locations, recipes, offerings, inventory movements, orders, and staff access all
benefit from foreign keys, constraints, transactions, and precise numeric types. PostgreSQL owns
relational integrity, while Spring owns workflows and authorization. The local Supabase stack
provides Auth only at this integration boundary; application data remains in the PostgreSQL
database owned by Spring and Flyway.

Flyway is the only schema-change mechanism. Versioned migrations make changes deliberate and
reviewable when the model evolves, and Hibernate runs with `ddl-auto=validate` so it can detect a
mapping mismatch without modifying the schema. Inventory balances and their immutable movement
history live in the same database transaction as order completion to prevent overselling.

The fully local, self-hosted Supabase Auth service (GoTrue) is the authentication issuer; the
hosted Supabase platform is not used. GoTrue performs sign-in and owns access/refresh session
lifecycle. Kong is the local gateway which exposes GoTrue at `/auth/v1` and gives tokens the stable
issuer `http://localhost:8000/auth/v1`. Spring Security is configured as an OAuth 2.0 resource
server and validates access JWTs against GoTrue's asymmetric ES256 public JWKS at
`kong:8000/auth/v1/.well-known/jwks.json`, the expected issuer, and the `authenticated` audience.
Validation has no runtime internet dependency. Spring does not receive a signing secret, mint a
second application JWT, or expose application login/password/refresh endpoints. The decision and
its deferred identity migration are recorded in
[ADR 0003](decisions/0003-local-supabase-auth.md).

Authentication does not grant domain access by itself. Customer signup provisions only the
server-side account mapping; authorization is resolved from current memberships and location
assignments rather than mutable user metadata or client-provided claims. V4 defines the external
user mapping and makes legacy credential columns optional; the legacy refresh-session lifecycle is
still undecided.

## Local infrastructure

Docker Compose runs a trimmed local Supabase stack, the Spring backend, and the frontend
workspace. Postgres uses a persistent named volume, every service has a health check, and
dependency conditions prevent the application from starting before its local infrastructure is
ready. Flyway remains the only application schema-change mechanism; the Supabase Auth service owns
its own schema.

| Component | Local implementation | Responsibility |
| --- | --- | --- |
| Database | `supabase/postgres:17.6.1.136`, host port `54322` | One PostgreSQL instance for application data and the isolated GoTrue schema; Flyway owns application migrations. |
| Authentication | GoTrue `supabase/gotrue:v2.189.0` | Local sign-in, access tokens, refresh sessions, and the asymmetric signing key. |
| Auth gateway | Kong `kong:3.9.1`, host port `8000` | Routes `/auth/v1` to GoTrue and exposes its issuer and public JWKS consistently. |
| Application API | Spring Boot 4.1 on Java 21, host port `8080` | Modular-monolith workflows, authorization, Flyway migrations, and access-token validation. |
| Frontend workspace | Node `24.16.0`, pnpm `11.9.0`, and Nginx, host port `4173` | React SPA build, guest ordering preview, customer accounts, and staff sign-in. |

Inside Compose, the backend connects to PostgreSQL at `db:5432` and fetches public signing keys
from Kong at `kong:8000`; it does not call a hosted service. Host ports bind to `127.0.0.1` only.
The concrete setup and endpoint checks are documented in
[Local Docker development](../development/local-docker.md).

The committed `.env.example` contains only non-secret defaults. A local generator creates a random
JWT secret and an ES256 private JWK, writing them to standard output so they can be appended to the
ignored `.env` file. No private signing key, access token, or production credential belongs in the
repository. Local email confirmation is automatic because this focused development stack has no
SMTP service; it is not a production email design.

Hosting is intentionally local-only. The backend and Supabase services share a private Compose
network, and Spring discovers public signing keys from the local gateway without a runtime internet
dependency. No hosted Supabase project, region, production container platform, or deployment
pipeline is selected. Production images, observability, backups, and CI deployment gates remain
future work.

## Tooling and testing

The Maven wrapper pins the backend build environment. Backend tests use JUnit 5, Spring Boot Test,
AssertJ, and Testcontainers against PostgreSQL. The current integration suite verifies Flyway
migrations, seeded guest catalog responses, Hibernate mappings, relational invariants, immutable
history, idempotent order completion, and concurrent protection against overselling. The local Auth key generator has a
Node test (`node --test infra/supabase/generate-local-auth-keys.test.mjs`) to ensure generated
JWKs remain acceptable to GoTrue.

Developers need a Java 21 JDK, Node 24 for the local generator, and a Docker-compatible runtime
for Compose and Testcontainers. The backend verification command is `cd backend && ./mvnw verify`;
it requires Docker because its integration tests start PostgreSQL with Testcontainers.

The frontend uses ESLint, TypeScript, Vitest, React Testing Library, and Vite production builds.
Browser end-to-end tests will be added with the first authenticated staff-context workflow.

## Experimental face authentication

Face authentication is a future experiment, not a committed production integration. The developer
may build a simple local model and is investigating whether matching and related processing can run
in the browser. No model, biometric provider, liveness technology, or storage design has been
selected or implemented.

Any experiment must remain opt-in, provide a non-biometric fallback, avoid retaining raw captures,
and treat templates and match data as sensitive. A production proposal would require a separate
privacy, legal, security, accessibility, and bias review. It would also need measurable liveness
and matching thresholds before it could become an authentication capability.
