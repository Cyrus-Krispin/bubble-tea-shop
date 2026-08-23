# Owner Manager Management

## Objective

Let an authenticated organization owner grant, inspect, scope, reactivate, and revoke manager
access without trusting browser-owned role or tenant data and without giving Spring a Supabase Auth
administration credential.

The target person first creates a normal customer account. Customer provisioning persists the
verified token email on the application account, and the owner grants access by that normalized
email. The workflow never creates an Auth identity, sends an invitation, changes an owner
membership, or reads the Supabase-owned schema.

## Authorization and lifecycle

- Every operation derives the caller from the verified JWT and requires an active `OWNER`
  membership in the path organization.
- Owners can manage only `MANAGER` memberships. Owner memberships are never returned or accepted as
  mutation targets.
- Assigned location identifiers must resolve to distinct, active locations in the same
  organization. At least one location is required for active manager access.
- Adding an account with no membership creates an active manager. Adding an inactive manager
  reactivates it with the submitted assignments. Adding an already-active manager conflicts.
- Assignment replacement requires the current optimistic version and updates the complete set in
  one transaction.
- Deactivation requires the current optimistic version, preserves assignments for history, and is
  an idempotent success when the membership is already inactive.
- Disabled or unknown customer accounts cannot receive access. Cross-organization identifiers use
  the same generic not-found/access response and do not disclose foreign state.

## API contract

- `GET /api/v1/staff/organizations/{organizationId}/managers` returns a deterministic, paginated
  list including active and inactive managers.
- `POST /api/v1/staff/organizations/{organizationId}/managers` accepts normalized email plus the
  complete initial location identifier set and creates or reactivates a manager.
- `PUT /api/v1/staff/organizations/{organizationId}/managers/{membershipId}/assignments` accepts the
  current version and complete replacement location identifier set.
- `POST /api/v1/staff/organizations/{organizationId}/managers/{membershipId}/deactivate` accepts the
  current version and deactivates access.

Responses never contain a Supabase subject. Errors use RFC 9457 problem details with stable codes
for invalid requests, unknown accounts, conflicts, stale versions, and authorization failures.

## Audit and integrity

Manager creation, reactivation, assignment replacement, and deactivation append an actor-attributed
`staff_access_change` row in the same transaction. The ledger is database-enforced immutable and
is visible only to owners through the staff audit timeline. Manager membership versions are
non-negative and increment once per successful mutation.
