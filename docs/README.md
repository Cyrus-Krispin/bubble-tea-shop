# Documentation

This directory records product intent and architectural decisions separately from implementation.
The Flyway migration remains the executable source of truth for the database.

## Index

- [`product/mvp.md`](product/mvp.md) — MVP scope, roles, workflows, and deferred stories.
- [`product/glossary.md`](product/glossary.md) — shared domain language.
- [`architecture/overview.md`](architecture/overview.md) — system shape and module responsibilities.
- [`architecture/technology-stack.md`](architecture/technology-stack.md) — selected technologies,
  implementation status, and the rationale behind each choice.
- [`architecture/security.md`](architecture/security.md) — authentication and authorization
  direction.
- [`architecture/face-authentication.md`](architecture/face-authentication.md) — deferred customer
  face-authentication experiment and its relationship to local Supabase authentication.
- [`architecture/decisions/0001-schema-first-modular-monolith.md`](architecture/decisions/0001-schema-first-modular-monolith.md)
  — foundational ADR.
- [`architecture/decisions/0002-supabase-managed-services.md`](architecture/decisions/0002-supabase-managed-services.md)
  — superseded managed-service direction.
- [`architecture/decisions/0003-local-supabase-auth.md`](architecture/decisions/0003-local-supabase-auth.md)
  — accepted local-only Supabase Auth boundary.
- [`database/schema.md`](database/schema.md) — complete tables, columns, keys, relationships, and indexes.
- [`database/erd.md`](database/erd.md) — entity relationship diagrams.
- [`database/data-dictionary.md`](database/data-dictionary.md) — tables and lifecycle rules.
- [`database/invariants.md`](database/invariants.md) — transactional and data integrity rules.
- [`api/conventions.md`](api/conventions.md) — future HTTP and OpenAPI conventions.
- [`../frontend/docs/visual-style-guide.md`](../frontend/docs/visual-style-guide.md) — selected
  customer ordering visual direction and frontend interaction guidance.
- [`delivery/roadmap.md`](delivery/roadmap.md) — incremental delivery order and acceptance gates.
- [`development/local-docker.md`](development/local-docker.md) — local Supabase, backend, and
  frontend Docker workflow.

## Documentation rules

1. Add an ADR when a decision is expensive to reverse or affects more than one module.
2. Update the ERD, dictionary, and invariants in the same change as a Flyway schema migration.
3. Never edit an applied Flyway migration; add a new versioned migration instead.
4. Keep generated OpenAPI artifacts separate from human-authored API conventions.
