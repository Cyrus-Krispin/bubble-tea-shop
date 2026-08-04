# Security Model

## Authentication

- The fully local, self-hosted Supabase Auth service is the authentication issuer. No hosted
  Supabase project is used. Local Auth owns sign-in, password handling, access-token issuance,
  refresh rotation, and logout/session lifecycle.
- The React client will send the Supabase access token to Spring as an
  `Authorization: Bearer <token>` header. Spring does not mint another application JWT.
- Spring validates the signature against the local stack's JWKS plus the expected local issuer,
  `authenticated` audience, and standard token timestamps before accepting a request.
- Only asymmetric Supabase signing keys are supported. The backend never receives or stores the
  legacy JWT secret, a secret/service-role key, a refresh token, or a raw access token.
- The token subject (`sub`) is the external Supabase user identifier. A later identity increment
  will map it to the application's account and load current memberships from PostgreSQL.
- The existing password and refresh-session columns predate this issuer decision and are not used
  by this integration. Removing or repurposing them requires a later versioned migration.
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

The current slice protects the API boundary but adds no login, refresh, logout, or password
endpoint and no frontend sign-in UI. It also does not treat `role`, `user_metadata`, organization,
location, or other token claims as application authorization evidence.

## Authorization

- `OWNER` is organization-wide.
- `MANAGER` is effective only while its membership is active and for assigned locations.
- Deactivation preserves audit history.
- Every command resolves organization and location access before loading or mutating domain data.
- Client-provided organization IDs are never trusted as authorization evidence.

## Browser boundary

- Supabase's client library will own browser session persistence and refresh behavior when the
  frontend authentication increment is implemented.
- Access tokens must not be logged or placed in URLs.
- Authentication failures use generic messages so username enumeration is not exposed.
- Audit records retain the acting account identifier where a staff action caused a state change.
