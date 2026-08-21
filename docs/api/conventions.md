# API Conventions

The guest catalog is the first implemented HTTP surface. Remaining endpoints follow these
conventions as controllers are introduced.

## Contract

- Spring DTOs are the current contract source. OpenAPI generation and generated frontend types are
  the next contract-tooling increment.
- JPA entities never cross the HTTP boundary.
- Breaking changes require a versioning decision and migration note.

## Resource conventions

- Prefix endpoints with `/api/v1`.
- Use UUID resource IDs and a separate human-readable order number.
- Use ISO-8601 UTC instants and ISO 4217 currency codes.
- Represent monetary values as `{ "amountMinor": 500, "currency": "SGD" }`.
- Represent quantities as decimal strings to preserve precision.
- Require an `Idempotency-Key` for guest order placement and external payment operations.

## Errors

Use RFC 9457 problem details with a stable application error code:

```json
{
  "type": "https://bubble-tea.example/problems/insufficient-stock",
  "title": "Insufficient stock",
  "status": 409,
  "code": "INVENTORY_SHORTAGE",
  "detail": "The order cannot be completed.",
  "shortages": [
    {
      "ingredientId": "f4f03618-c35f-4ec3-9b92-5375735a88ae",
      "required": "50.000000",
      "available": "30.000000"
    }
  ]
}
```

Validation errors use `400`, authentication failures `401`, authorization failures `403`, missing
resources `404`, state conflicts `409`, and unexpected failures `500`.

## Authentication

- The local Supabase Auth service is the authentication issuer. The application does not expose
  custom login, refresh-token rotation, or logout endpoints.
- The browser presents its Supabase access token as an HTTP bearer token. Spring validates it
  against the local issuer, audience, timestamps, and asymmetric JWKS before dispatching `/api/**`.
- After identity verification, Spring resolves the caller's active application account,
  organization membership, role, and location assignments on the server.
- Organization, location, role, price, and inventory values supplied by the browser or stored in
  untrusted identity metadata are not authorization evidence.
- Domain APIs remain Spring endpoints; the frontend does not write application tables directly
  through Supabase data APIs.

## Customer account

`POST /api/v1/customer/account` is an authenticated, bodyless, idempotent provisioning endpoint.
It derives the external identity and display email from the verified Supabase token, creates the
application `account` on the first request, and returns the existing account afterward. The first
response is `201`; later responses are `200`.

The endpoint never accepts or creates an organization, location, role, or membership. Invalid
identity claims return `401` with `CUSTOMER_IDENTITY_INVALID`; a disabled application account
returns `403` with `CUSTOMER_ACCOUNT_DISABLED`.

## Staff context

`GET /api/v1/staff/context` is authenticated and bodyless. It derives the caller from the verified
token subject and returns every active organization membership in deterministic name order. Owner
memberships include every active organization location; manager memberships include only active
locations with a current database assignment. Each location includes its ID, name, timezone,
default locale, and currency code.

The endpoint accepts no organization, location, role, or assignment input. Missing authentication
is rejected by the security filter. A missing or non-UUID token subject returns `401` with
`STAFF_IDENTITY_INVALID`; an unmapped identity or identity without active staff membership returns
`403` with `STAFF_ACCESS_DENIED`; and a disabled mapped account returns `403` with
`STAFF_ACCOUNT_DISABLED`.

## Guest catalog

These read-only endpoints are public so a guest can browse without a Supabase session:

- `GET /api/v1/guest/menu` and `GET /api/v1/guest/menu/products/{productSlug}` resolve the
  deployment-configured MVP guest location and are the frontend's current endpoints.
- `GET /api/v1/guest/locations/{locationSlug}/menu` returns the active location and ordered product
  summaries with database-owned availability and starting prices.
- `GET /api/v1/guest/locations/{locationSlug}/menu/products/{productSlug}` returns available size
  variants, exact variant prices, and enabled option groups and choices.

`GUEST_LOCATION_SLUG` configures the current MVP location on the server; the frontend does not own
or duplicate that domain value. The menu is a bounded singleton resource for one location, so it is not paginated. Unknown or
inactive locations and products return `404` problem details with `CATALOG_NOT_FOUND` or
`CATALOG_PRODUCT_NOT_FOUND`. All other `/api/**` routes keep their configured authentication or
deny-by-default rule.
