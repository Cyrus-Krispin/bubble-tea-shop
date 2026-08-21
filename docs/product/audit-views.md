# Staff Audit Views

The staff audit workspace is a read-only, newest-first timeline of durable catalog changes,
inventory movements, and order status transitions. It helps owners and managers answer who changed
what, when, and at which location without granting direct database access.

## Scope and authorization

- Owners see organization-wide catalog events and operational events from every organization
  location.
- Managers see organization-wide catalog events plus inventory and order events only for their
  assigned locations.
- Cross-organization identifiers fail with the standard staff access response and never reveal
  whether another organization's data exists.
- Actor UUIDs are server-resolved from the authenticated account or stored workflow history. Guest
  system events may have no actor.

## Timeline contract

`GET /api/v1/staff/organizations/{organizationId}/audit-events` accepts an optional `category`
(`CATALOG`, `INVENTORY`, or `ORDER`) and bounded `page`/`size` parameters. Events are ordered by
timestamp and UUID descending for deterministic pagination. Each event includes its category,
action, entity type and identifier, safe display label, optional location, optional actor, timestamp,
and a short server-derived detail. Arbitrary request payloads, tokens, and secrets are never stored
or returned as audit detail.

The source tables remain authoritative. Catalog changes, inventory movements, and order status
history are append-only, and no audit endpoint supports update or deletion.
