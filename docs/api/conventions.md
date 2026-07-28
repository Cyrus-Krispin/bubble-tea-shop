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

- Access JWTs are sent as bearer tokens.
- Refresh tokens are accepted only from the protected cookie.
- A token's organization/location claims are hints; authorization is resolved against active
  memberships and assignments on the server.

