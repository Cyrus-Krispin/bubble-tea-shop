# Staff Access Specification

## Objective

Allow a previously provisioned Supabase identity to receive owner access through an explicit
operator command, then let authenticated owners and managers load their current server-owned staff
scope. Authentication proves identity only; PostgreSQL account, membership, and assignment records
remain the sole authorization source.

Success means an owner can bootstrap access without placing privileged Auth credentials in Spring,
while a browser identity without an active membership cannot discover or use staff scope.

## Contract

### Owner bootstrap

The operator first creates the owner through the normal customer registration/provisioning flow.
The bootstrap command then requires:

- the existing Supabase Auth subject UUID;
- the existing organization UUID; and
- explicit opt-in to command mode.

The command creates an active `OWNER` membership only when no membership exists for that account
and organization. Repeating it for the same active owner is a successful no-op. It fails without
changing data when the account is missing or disabled, the organization is missing, or an existing
membership is inactive or has another role. It never creates an Auth user, accepts a service-role
key, writes the Supabase `auth` schema, creates a manager, or reactivates/promotes access.

### Staff context API

`GET /api/v1/staff/context` requires a verified Supabase access token and returns:

- application account ID;
- each active organization membership with organization ID/name and `OWNER` or `MANAGER` role;
- active locations visible to that membership.

Owners receive every active location in their organization. Managers receive only active locations
with a current assignment. The response is ordered deterministically by organization and location
name. An identity with multiple active memberships receives all of them; no browser-supplied tenant,
role, or location chooses the result.

Errors use RFC 9457 problem details:

| Condition | Status | Code |
| --- | --- | --- |
| Missing or non-UUID token subject | `401` | `STAFF_IDENTITY_INVALID` |
| No mapped account or no active membership | `403` | `STAFF_ACCESS_DENIED` |
| Disabled mapped account | `403` | `STAFF_ACCOUNT_DISABLED` |

## Tech Stack

- Java 21 and Spring Boot 4.1.
- Spring Security resource server with asymmetric Supabase JWKS verification.
- Spring `JdbcClient` transactions for identity reads/bootstrap writes.
- PostgreSQL 18 constraints remain authoritative; no schema change is required.

## Commands

Focused tests:

```bash
cd backend
./mvnw -Dtest=StaffContextApiIntegrationTest,OwnerBootstrapServiceIntegrationTest test
```

Full backend verification:

```bash
cd backend
./mvnw verify
```

Operator command shape (environment-specific values omitted):

```bash
OWNER_BOOTSTRAP_ENABLED=true \
OWNER_BOOTSTRAP_AUTH_SUBJECT=<uuid> \
OWNER_BOOTSTRAP_ORGANIZATION_ID=<uuid> \
./mvnw spring-boot:run \
  -Dspring-boot.run.arguments=--spring.main.web-application-type=none
```

## Project Structure

- `backend/src/main/java/com/bubbletea/shop/identity/` owns bootstrap and staff-context logic.
- `backend/src/main/java/com/bubbletea/shop/identity/security/` owns token verification only.
- `backend/src/test/java/com/bubbletea/shop/identity/` contains PostgreSQL-backed contract tests.
- `frontend/src/features/staff/` owns runtime response validation and the guarded workspace.
- `docs/architecture/security.md` and `docs/api/conventions.md` record the shipped boundary.

## Code Style

Use application-service records as explicit boundaries; controllers never expose entities:

```java
public record StaffMembership(
    UUID organizationId,
    String organizationName,
    Role role,
    List<StaffLocation> locations
) {
}
```

SQL uses named parameters and deterministic ordering. Authorization queries begin from the verified
subject and join server-owned records; they never accept organization, role, or location input from
the request.

## Testing Strategy

- Integration tests use PostgreSQL 18 through Testcontainers and real Flyway migrations.
- Bootstrap tests cover first creation, idempotent retry, and every fail-closed conflict with no
  partial writes.
- API tests cover owner scope, manager assignment scope, multiple memberships, inactive locations,
  disabled/unmapped identities, no membership, invalid subjects, public rejection, and stable
  problem details.
- Existing JWT decoder and customer-account tests remain green.
- Frontend tests cover signed-out redirects, server-returned scope, malformed responses, and denied
  customer-only identities without fallback roles or locations.

## Boundaries

- Always: derive the subject from the verified JWT; resolve every permission from current database
  state; preserve deterministic responses and generic authorization errors.
- Ask first: any flow that creates Auth users, accepts an Auth admin/service-role credential,
  reactivates/promotes memberships, or changes the schema.
- Never: trust `role`, `user_metadata`, `app_metadata`, organization, or location claims for
  application authorization; write Supabase-owned schemas; log tokens or bootstrap secrets.

## Success Criteria

- Bootstrap is explicit, idempotent, transactional, and cannot silently elevate existing access.
- Owners see all active organization locations; managers see only active assigned locations.
- Unmapped, disabled, inactive, or customer-only identities receive no staff scope.
- Tests, backend build, documentation link checks, and Compose-backed smoke verification pass.

## Open Questions

None for the MVP. Manager invitation/deactivation UI belongs to the subsequent owner-management
slice; production secret storage and deployment command wrappers belong to operational hardening.
