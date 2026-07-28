# ADR 0001: Schema-first modular monolith

- Status: Accepted
- Date: 2026-07-28

## Context

The MVP spans catalog, inventory, ordering, and staff access, but will be developed by a small team.
Inventory correctness requires strong transactions across order and stock data.

## Decision

- Use one Spring Boot 4.1 application on Java 21, built with Maven.
- Use PostgreSQL 18 with Flyway as the only schema-change mechanism.
- Keep package-by-domain module boundaries inside the application.
- Use one React/Vite SPA and generate its API client from Spring OpenAPI.
- Keep the inventory ledger and balance update in the same database transaction.

## Consequences

- Cross-domain workflows are straightforward and strongly consistent.
- Deployment and local development remain simple.
- Module discipline must be enforced in code because process boundaries do not enforce it.
- A service can be extracted later only when operational evidence justifies the added complexity.

