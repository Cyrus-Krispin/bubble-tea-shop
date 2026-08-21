# Documentation

This directory records product intent and architectural decisions separately from implementation.
The Flyway migration remains the executable source of truth for the database.

## Index

- [`product/mvp.md`](product/mvp.md) — MVP scope, roles, workflows, and deferred stories.
- [`product/staff-access.md`](product/staff-access.md) — owner bootstrap and server-resolved staff
  authorization contract.
- [`product/owner-manager-management.md`](product/owner-manager-management.md) — owner-only manager
  membership and location-assignment lifecycle.
- [`product/catalog-management.md`](product/catalog-management.md) — staff catalog authorization,
  ingredient lifecycle, concurrency, and audit contract.
- [`product/inventory-management.md`](product/inventory-management.md) — location-scoped balances,
  immutable movements, and manual stock workflow contract.
- [`product/guest-order-placement.md`](product/guest-order-placement.md) — server-priced guest
  checkout, immutable snapshots, and idempotent placement contract.
- [`product/staff-order-operations.md`](product/staff-order-operations.md) — authorized order queue,
  atomic cash collection, and inventory-safe completion contract.
- [`product/audit-views.md`](product/audit-views.md) — role-scoped, read-only operational audit
  timeline contract.
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
- [`api/conventions.md`](api/conventions.md) — HTTP conventions and contract workflow.
- [`api/openapi.json`](api/openapi.json) — generated OpenAPI 3.1 contract snapshot.
- [`../frontend/docs/visual-style-guide.md`](../frontend/docs/visual-style-guide.md) — selected
  customer ordering visual direction and frontend interaction guidance.
- [`delivery/roadmap.md`](delivery/roadmap.md) — incremental delivery order and acceptance gates.
- [`development/local-docker.md`](development/local-docker.md) — local Supabase, backend, and
  frontend Docker workflow.
- [`development/continuous-integration.md`](development/continuous-integration.md) — required CI
  checks and their local equivalents.
- [`development/accessibility.md`](development/accessibility.md) — automated WCAG checks and the
  required real-browser review boundary.
- [`operations/backup-restore.md`](operations/backup-restore.md) — PostgreSQL backup policy,
  recovery safeguards, and restore drills.
- [`operations/deployment.md`](operations/deployment.md) — production image, configuration,
  network, release, and rollback contract.
- [`operations/observability.md`](operations/observability.md) — structured logs, request
  correlation, health, metrics, dashboards, and alerting.

## Documentation rules

1. Add an ADR when a decision is expensive to reverse or affects more than one module.
2. Update the ERD, dictionary, and invariants in the same change as a Flyway schema migration.
3. Never edit an applied Flyway migration; add a new versioned migration instead.
4. Keep generated OpenAPI artifacts separate from human-authored API conventions.
