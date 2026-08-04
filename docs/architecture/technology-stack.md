# Technology Stack and Rationale

Bubble Tea Shop uses a deliberately familiar backend stack and a flexible frontend stack. The goal
is to spend less time experimenting with infrastructure and more time on the ordering experience,
shop workflows, and user interface. This document describes the selected direction even where a
part of the application has not been implemented yet.

## Frontend

The frontend is planned as a single React application written in TypeScript and built with Vite.
React and TypeScript provide enough flexibility to support the public menu, staff workflows, owner
administration, and display views without introducing separate frontend applications. Vite keeps
the development loop lightweight, while pnpm manages the workspace on Node.js.

Tailwind CSS is the intended styling approach because it makes UI iteration fast and works well
with AI-assisted implementation. Radix-based components will provide accessible behavior beneath
the shop's own design system, TanStack Query will manage server state, and Storybook will support
isolated component development. The frontend will consume a typed client generated from the
Spring OpenAPI contract so that API changes remain visible at compile time.

The frontend directory currently contains only the Node and pnpm workspace foundation. React,
TypeScript, Vite, Tailwind, Radix, TanStack Query, Storybook, and OpenAPI generation are selected
choices for the next delivery phases rather than installed production code.

## Backend and API

The backend is a Java 21 application built with Spring Boot 4.1 and Maven. Java and Spring Boot are
the developer's strongest and most familiar backend technologies. Choosing them avoids making the
backend an experiment and leaves more attention for user experience and frontend quality.

The application is a modular monolith organized around identity, catalog, inventory, and ordering.
This keeps deployment and local development simple while allowing inventory and order completion
to share a strongly consistent transaction. Spring Data JPA and Hibernate map the domain data,
while focused workflow services can use Spring JDBC when explicit locking and SQL make transaction
behavior clearer. Spring Validation and Spring Security are included as the foundations for future
HTTP input validation and staff access control.

There are no HTTP controllers in the current schema-first slice. The planned API will expose JSON
over HTTPS under `/api/v1`, publish an OpenAPI contract, and return DTOs rather than persistence
entities.

## Data and authentication

PostgreSQL is the system of record. The expected data model is well understood and relational:
organizations, locations, recipes, offerings, inventory movements, orders, and staff access all
benefit from foreign keys, constraints, transactions, and precise numeric types. PostgreSQL owns
relational integrity, while Spring owns workflows and authorization.

Flyway is the only schema-change mechanism. Versioned migrations make changes deliberate and
reviewable when the model evolves, and Hibernate runs with `ddl-auto=validate` so it can detect a
mapping mismatch without modifying the schema. Inventory balances and their immutable movement
history live in the same database transaction as order completion to prevent overselling.

Local Supabase Auth is the development identity provider. It runs in the same Compose project as
the application and database, so development does not depend on a hosted Supabase project or an
online signing-key endpoint. Spring Security remains the application authorization boundary:
organization memberships, roles, and location assignments must still be resolved server-side
rather than trusted from client claims. The concrete JWT-validation integration is delivered
separately from this container foundation.

The account, membership, location-assignment, and refresh-session schema exists today, but the
login, token rotation, logout, and authorization endpoints are planned work.

## Local infrastructure

Docker Compose runs a trimmed local Supabase stack (the official Postgres and GoTrue images), the
Spring backend, and the frontend workspace. Postgres uses a persistent named volume, every service
has a health check, and dependency conditions prevent the application from starting before its
local infrastructure is ready. Flyway remains the only application schema-change mechanism; the
Supabase Auth service owns its own schema.

Hosting is intentionally local-only for now. The repository does not use a hosted Supabase project
and does not select a cloud provider, production container platform, managed database, or
deployment pipeline. The Compose file must not be treated as production configuration: its local
credentials, loopback ports, auto-confirmed email accounts, persistence, backups, TLS, and
observability are deliberately development-grade.

## Tooling and testing

The Maven wrapper pins the backend build environment. Backend tests use JUnit 5, Spring Boot Test,
AssertJ, and Testcontainers against PostgreSQL. The
current integration suite verifies Flyway migrations, Hibernate mappings, relational invariants,
immutable history, idempotent order completion, and concurrent protection against overselling.

Frontend linting, type checking, component tests, end-to-end tests, and production builds will be
added with the frontend implementation.

## Experimental face authentication

Face authentication is a future experiment, not a committed production integration. The developer
may build a simple local model and is investigating whether matching and related processing can run
in the browser. No model, biometric provider, liveness technology, or storage design has been
selected or implemented.

Any experiment must remain opt-in, provide a non-biometric fallback, avoid retaining raw captures,
and treat templates and match data as sensitive. A production proposal would require a separate
privacy, legal, security, accessibility, and bias review. It would also need measurable liveness
and matching thresholds before it could become an authentication capability.
