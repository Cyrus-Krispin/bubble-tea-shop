# Security Model

## Authentication

- Usernames are stored as entered plus a globally unique, lowercase normalized value.
- Passwords will use BCrypt with an explicit work factor of 12.
- Access tokens are JWTs with a 15-minute lifetime.
- Refresh tokens rotate on every use, expire after 14 days, and are sent only in a Secure,
  HttpOnly, SameSite=Lax cookie.
- Only a token hash is stored in `refresh_session`; logout and suspected reuse revoke the session.
- Production owner credentials are created by an explicit bootstrap workflow, never a migration.

## Authorization

- `OWNER` is organization-wide.
- `MANAGER` is effective only while its membership is active and for assigned locations.
- Deactivation preserves audit history.
- Every command resolves organization and location access before loading or mutating domain data.
- Client-provided organization IDs are never trusted as authorization evidence.

## Browser boundary

- The access JWT is kept in memory rather than durable browser storage.
- Refresh endpoints require origin/CSRF protection in addition to SameSite cookies.
- Authentication failures use generic messages so username enumeration is not exposed.
- Audit records retain the acting account identifier where a staff action caused a state change.

