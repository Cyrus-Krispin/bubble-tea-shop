# ADR 0002: Supabase managed services

- Status: Superseded by [ADR 0003](0003-local-supabase-auth.md)
- Date: 2026-08-04

## Context

The schema-first foundation included tables and documentation for application-owned password
authentication, access tokens, and rotating refresh sessions. No authentication endpoints or
session workflows were implemented, and the project has since selected Supabase as its managed
authentication and data-service direction.

The application still needs a trusted boundary for organization, role, location, price, and
inventory decisions. Moving credential management to Supabase does not make browser-supplied
authorization data authoritative and does not turn the React application into a direct domain-data
backend.

## Decision

- Supabase is the selected managed service for authentication and, where adopted, managed
  PostgreSQL data services.
- The application will not implement its own password verification, token issuance, or refresh-
  session rotation.
- Spring remains the only custom application backend and the boundary for domain operations.
- Spring resolves authorization from server-owned organization memberships and location
  assignments after the caller's Supabase identity has been verified.
- Flyway remains the schema-change mechanism for application-owned PostgreSQL objects.
- The committed V1 migration remains immutable even though its credential and refresh-session
  structures reflect the superseded design.

## Open integration decisions

This ADR selects the service direction, not a final authentication flow. The following decisions
must be settled before implementation:

- whether the first Supabase integration uses Auth only or Auth plus managed PostgreSQL;
- how a Supabase identity maps to the application `account` record;
- how browser credentials are presented to and verified by Spring;
- how a later Flyway migration retires or reshapes V1 password and refresh-session fields;
- how Supabase and PostgreSQL run during local development;
- how the first owner is provisioned and linked without embedding credentials in a migration.

Provider-specific login methods, session storage, callbacks, service keys, row-level security, and
production hosting are not selected by this ADR.

## Consequences

- Supabase owns managed identity and session concerns; Spring continues to own business workflows
  and authorization.
- Phase 2 begins with an identity-link and authorization-boundary slice before catalog APIs rely on
  an authenticated actor.
- Existing schema and JPA mappings describe implemented Phase 1 state, not the target Supabase
  integration. They require a new versioned migration and corresponding mapping changes.
- The frontend must not bypass Spring for catalog, inventory, ordering, or authorization decisions.
