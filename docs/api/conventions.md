# API Conventions

No HTTP endpoints are included in the schema-first slice. These conventions apply when controllers
are introduced.

## Contract

- Spring-generated OpenAPI is the contract source.
- Frontend request/response types and client functions are generated from the committed contract.
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
