# Security Model

## Implementation status

The fully local, self-hosted Supabase Auth service is the authentication issuer, superseding the
earlier plan for Spring to verify passwords, issue access tokens, and rotate application-owned
refresh sessions. Spring implements bearer-token validation, customer identity provisioning, the
operator-only owner bootstrap, and a staff context endpoint backed by server-owned scope
resolution. Catalog, inventory, and order operations use that scope; staff membership management
is owner-only and records immutable actor-attributed access changes.

The Phase 1 schema still contains legacy credential and refresh-session columns. Flyway V4 keeps
the immutable V1 columns for compatibility, makes the application-owned credential fields
optional, and adds the unique Supabase `auth_subject` mapping. Supabase remains the only password
and browser-session owner; the unused `refresh_session` lifecycle remains a later decision.

## Authentication

- The fully local, self-hosted Supabase Auth service is the authentication issuer. No hosted
  Supabase project is used. Local Auth owns sign-in, password handling, access-token issuance,
  refresh rotation, and logout/session lifecycle.
- The React client sends the Supabase access token to Spring as an
  `Authorization: Bearer <token>` header. Spring does not mint another application JWT.
- Browser sign-in uses the local gateway base URL; the Supabase client appends `/auth/v1` itself.
  Kong allows Auth CORS requests only from the local frontend origin and only with the request
  headers required by the client.
- Spring validates the signature against the local stack's JWKS plus the expected local issuer,
  `authenticated` audience, and standard token timestamps before accepting a request.
- Only asymmetric Supabase signing keys are supported. The backend never receives or stores the
  legacy JWT secret, a secret/service-role key, a refresh token, or a raw access token.
- The token subject (`sub`) is mapped uniquely to `account.auth_subject` when a customer provisions
  an application account. The endpoint takes no role or organization input and creates no
  membership.
- The existing password and refresh-session columns predate this issuer decision and are not used
  by this integration. V4 makes the credential fields optional; removing legacy columns or the
  refresh-session table requires a later versioned migration.
- Future customer face authentication is an alternative credential check before normal token
  issuance by the authentication issuer; the matching component never issues JWTs. See
  [`face-authentication.md`](face-authentication.md).

### Backend configuration

JWT validation is deliberately opt-in. When `LOCAL_SUPABASE_AUTH_ENABLED` is absent or `false`, Spring
denies all `/api/**` requests. To enable the resource server, copy `.env.example` to an ignored
local `.env` (or inject the same variables through the runtime environment) and set the network
contract shared with the separate local-Supabase Compose work:

```text
LOCAL_SUPABASE_AUTH_ENABLED=true
LOCAL_SUPABASE_AUTH_ISSUER_URI=http://localhost:8000/auth/v1
LOCAL_SUPABASE_AUTH_JWK_SET_URI=http://kong:8000/auth/v1/.well-known/jwks.json
LOCAL_SUPABASE_AUTH_AUDIENCE=authenticated
```

The issuer is the exact `iss` value configured into local Auth and visible to local clients. The
JWKS URI is deliberately different: it uses the `kong` service name on the private Compose network,
so the backend retrieves public verification keys without internet access. These URLs are
identifiers, not credentials. If the backend runs directly on the host for development, override
the JWKS URI with `http://localhost:8000/auth/v1/.well-known/jwks.json`.

The local Supabase stack must configure `GOTRUE_JWT_KEYS` with an asymmetric ES256 or RS256 signing
key and expose its public half at the JWKS endpoint. The backend does not accept legacy/shared-secret
HS256 tokens and never receives `JWT_SECRET`, `JWT_KEYS`, `JWT_JWKS`, an API secret/service-role key,
or a raw user token. The exact Compose services and generated local secrets belong to the separate
local-stack infrastructure change, not this backend integration.

The current slice protects the API boundary, provides a unified customer account-access surface and
a distinct staff sign-in route, and provisions the application account after Supabase returns a
customer session. Customer mode switching does not imply or grant a role. Validated same-origin
return paths restore the requested customer or staff destination after authentication.
Guest catalog reads, `POST /api/v1/guest/orders`, and
`POST /api/v1/guest/locations/{locationSlug}/orders` are explicitly public. Order placement accepts
an optional verified bearer token only to resolve an enabled customer account; it validates all
catalog identifiers and recalculates prices, totals, currency, payment, and consumption on the
server.
The browser client delegates session persistence and refresh to Supabase Auth; it does not log or
manually store access or refresh tokens. It adds no Spring login, refresh, logout, or password
endpoint and does not treat `role`, `user_metadata`, organization, location, or other token claims
as application authorization evidence.
Self-service Auth signup creates customer identities only. Initial owner access requires the
explicit operator-only bootstrap. An authenticated owner may subsequently grant, scope,
deactivate, or reactivate manager access for existing verified application accounts through the
Spring API. Spring never derives staff access from signup metadata.

Customer order-history reads resolve `account.id` only from the verified token subject and include
that account in every order query. The API accepts no customer account identifier. An order owned
by another account is indistinguishable from an unknown order, and list sizes are bounded. The
frontend validates history payloads before rendering immutable snapshot text and never blocks the
public menu when personalization is unavailable.

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
- Staff order reads and completion are scoped through current server-owned memberships and active
  location assignments. Completion accepts no client-owned payment, price, inventory, actor, or
  status fields; the authenticated account is recorded as the cash-accepting actor in the same
  transaction as payment, order, history, and inventory changes.

## Browser and service boundary

- Supabase's client library owns browser session persistence and refresh behavior.
- Access tokens must not be logged or placed in URLs.
- Authentication failures use generic messages so username enumeration is not exposed.
- Audit records retain the acting account identifier where a staff action caused a state change.
