# Security Model

## Implementation status

Supabase is the selected managed authentication service, superseding the earlier plan for Spring
to verify passwords, issue access tokens, and rotate application-owned refresh sessions. The
repository does not yet implement Supabase authentication or any HTTP authentication endpoints.

The Phase 1 schema still contains `account.password_hash` and `refresh_session`, with matching JPA
entities. Those structures document implemented database state, not the target authentication
design. Flyway V1 is immutable, so a later versioned migration must reconcile them after the
identity mapping and migration lifecycle have been decided.

## Authentication

- Supabase owns managed credential verification, account recovery, and session concerns.
- The application does not issue its own login tokens or maintain custom refresh-token rotation.
- A Supabase identity must be linked to an application account before it can receive staff access.
- The exact identity key, provisioning workflow, browser session handling, and Spring validation
  mechanism are still open integration decisions.
- Production owner access requires an explicit Supabase provisioning and application-linking
  workflow. Credentials are never created by a Flyway migration.
- Future customer face authentication remains an opt-in experiment. It cannot establish a parallel
  application-owned session or bypass Supabase. See
  [`face-authentication.md`](face-authentication.md).

Selecting Supabase does not select a login provider, MFA method, callback design, service-key
placement, row-level-security policy, or production hosting environment. Those choices require
separate decisions before implementation.

## Authorization

- Authentication establishes identity; it does not grant organization or location access by
  itself.
- `OWNER` is organization-wide.
- `MANAGER` is effective only while its membership is active and for assigned locations.
- Deactivation preserves audit history.
- Spring resolves the verified Supabase identity to current server-owned account, membership, and
  assignment data before loading or mutating domain data.
- Client-provided organization IDs, location IDs, roles, prices, inventory values, or Supabase
  metadata are never accepted as authorization evidence.
- The React application does not call Supabase data APIs to bypass Spring domain workflows.

## Browser and service boundary

- The browser-to-Supabase sign-in flow and the credential presented to Spring have not been
  selected.
- Spring must verify the caller through a supported Supabase integration before resolving
  application authorization. The validation method, caching, failure behavior, and local test
  strategy must be documented with the implementation.
- CORS, CSRF, cookie, and durable-storage policies depend on the selected browser credential flow;
  the earlier fixed in-memory-token and custom refresh-cookie rules no longer apply.
- Authentication failures use generic messages where the application controls the response so
  account enumeration is not exposed.
- Audit records retain the acting application account identifier where a staff action caused a
  state change.
