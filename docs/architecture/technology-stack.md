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

PostgreSQL 18 is the system of record. The expected data model is well understood and relational:
organizations, locations, recipes, offerings, inventory movements, orders, and staff access all
benefit from foreign keys, constraints, transactions, and precise numeric types. PostgreSQL owns
relational integrity, while Spring owns workflows and authorization.

Flyway is the only schema-change mechanism. Versioned migrations make changes deliberate and
reviewable when the model evolves, and Hibernate runs with `ddl-auto=validate` so it can detect a
mapping mismatch without modifying the schema. Inventory balances and their immutable movement
history live in the same database transaction as order completion to prevent overselling.

The fully local, self-hosted Supabase Auth service is the authentication issuer; the hosted
Supabase platform is not used. Local Auth performs sign-in and owns access/refresh session
lifecycle. Spring Security is configured as an OAuth 2.0 resource server and validates access JWTs
against the asymmetric public JWKS served on the private Compose network, expected local issuer,
and `authenticated` audience. Validation has no runtime internet dependency. Spring does not
receive a signing secret, mint a second application JWT, or expose application
login/password/refresh endpoints.

Authentication does not grant domain access by itself. Authorization will be resolved from current
server-side account mappings, memberships, and location assignments rather than trusting mutable
user metadata or client-provided claims. The existing account and refresh-session schema predates
the Supabase issuer decision and remains unchanged until a later identity migration defines the
external-user mapping and legacy-column lifecycle.

## Local infrastructure

Docker Compose runs PostgreSQL locally with a persistent named volume and a health check. The
reason for Compose is practical: it gives every contributor the same database version and startup
path, removes ambiguity from local setup, and makes the application straightforward to run.

Hosting is intentionally local-only for now. The repository does not select a cloud provider,
production container platform, managed database, or deployment pipeline, and those choices should
not be inferred from the local Compose setup. Production images, observability, backups, and CI
deployment gates remain future work.

## Tooling and testing

The Maven wrapper pins the backend build environment. Backend tests use JUnit 5, Spring Boot Test,
AssertJ, and Testcontainers against the same PostgreSQL 18 image used for local development. The
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
