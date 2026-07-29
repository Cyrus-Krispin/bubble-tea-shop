# Documentation

This directory records product intent and architectural decisions separately from implementation.
The Flyway migration remains the executable source of truth for the database.

## Index

- [`product/mvp.md`](product/mvp.md) — MVP scope, roles, workflows, and deferred stories.
- [`product/glossary.md`](product/glossary.md) — shared domain language.
- [`architecture/overview.md`](architecture/overview.md) — system shape and module responsibilities.
- [`architecture/security.md`](architecture/security.md) — authentication and authorization direction.
- [`architecture/face-authentication.md`](architecture/face-authentication.md) — deferred customer
  face authentication and its integration with JWT sessions.
- [`architecture/decisions/0001-schema-first-modular-monolith.md`](architecture/decisions/0001-schema-first-modular-monolith.md) — foundational ADR.
- [`database/erd.md`](database/erd.md) — entity relationship diagrams.
- [`database/data-dictionary.md`](database/data-dictionary.md) — tables and lifecycle rules.
- [`database/invariants.md`](database/invariants.md) — transactional and data integrity rules.
- [`api/conventions.md`](api/conventions.md) — future HTTP and OpenAPI conventions.
- [`delivery/roadmap.md`](delivery/roadmap.md) — incremental delivery order and acceptance gates.

## Documentation rules

1. Add an ADR when a decision is expensive to reverse or affects more than one module.
2. Update the ERD, dictionary, and invariants in the same change as a Flyway schema migration.
3. Never edit an applied Flyway migration; add a new versioned migration instead.
4. Keep generated OpenAPI artifacts separate from human-authored API conventions.
