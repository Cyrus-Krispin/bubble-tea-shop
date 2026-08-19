# ADR 0003: Local Supabase Auth issuer

- Status: Accepted
- Date: 2026-08-04
- Supersedes: [ADR 0002](0002-supabase-managed-services.md) for authentication hosting and data-service scope

## Context

ADR 0002 selected Supabase while leaving the authentication topology and managed-data boundary
open. The project now requires a fully local development stack and must not depend on a hosted
Supabase project. Spring remains the only custom application backend and authorization boundary.

## Decision

- A self-hosted Supabase Auth service on the local Compose network issues user sessions and JWTs.
- Spring validates bearer JWT signatures through the local gateway's JWKS and enforces the exact
  local issuer, `authenticated` audience, and token timestamps.
- Spring does not receive a signing secret, issue an application JWT, or expose application login,
  password, refresh-session, or logout endpoints.
- Application data remains in PostgreSQL owned by Spring and Flyway; the browser does not use
  Supabase data APIs for domain operations.
- The runtime authentication path has no hosted Supabase or internet dependency.

## Consequences

- The Compose stack must provide an asymmetric ES256 or RS256 Auth signing key, expose its public
  JWKS through the local gateway, and place the backend on the same private network.
- Browser sign-in and session refresh will use the local Supabase client endpoint in a later slice.
- A later identity slice must map the verified JWT subject to an application account and reconcile
  the legacy V1 credential/session schema through a new Flyway migration.
- Production hosting remains undecided; adopting it requires a separate architecture decision.
