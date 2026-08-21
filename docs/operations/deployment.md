# Production Deployment Contract

The repository produces portable backend and frontend images but intentionally does not select a
cloud, registry, DNS name, or managed Supabase project. A production platform must satisfy this
contract before serving traffic.

## Images

- `backend/Dockerfile` builds the Spring Boot application on Java 21 and runs it as the unprivileged
  `app` user on port 8080.
- `frontend/Dockerfile` builds the Vite bundle and runs nginx as the unprivileged `nginx` user on
  port 4173.
- Build the frontend with `VITE_SUPABASE_URL` set to the browser-visible HTTPS Supabase origin.
  Run it with `SUPABASE_CONNECT_SRC` set to that same origin so the Content Security Policy permits
  only the intended Auth connection.
- Publish immutable image digests from a protected release workflow. Deploy by digest and retain
  the previous compatible digest for rollback.

## Backend configuration

Provide these values through the platform's secret or configuration service:

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | TLS-enabled JDBC URL for the production PostgreSQL database. |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | Dedicated application role; never a database superuser. |
| `LOCAL_SUPABASE_AUTH_ENABLED` | `true` when staff and customer identity is enabled. |
| `LOCAL_SUPABASE_AUTH_ISSUER_URI` | Exact public issuer in access tokens. Despite the legacy variable name, this may be a hosted Supabase issuer. |
| `LOCAL_SUPABASE_AUTH_JWK_SET_URI` | HTTPS or private-network JWK endpoint reachable by Spring. |
| `LOCAL_SUPABASE_AUTH_AUDIENCE` | Expected token audience, normally `authenticated`. |
| `GUEST_LOCATION_SLUG` | The one active public MVP location. |
| `OPENAPI_DOCS_ENABLED` | Keep `false` unless API documentation is deliberately exposed to a protected network. |
| `SPRING_PROFILES_ACTIVE` | Set to `production` to require production credentials and enable ECS JSON logs. |

Run owner bootstrap as an audited one-off task with temporary `OWNER_BOOTSTRAP_*` values, then
disable it. Do not leave bootstrap enabled in the long-running service.

## Network and runtime controls

1. Terminate TLS at a trusted ingress and redirect HTTP to HTTPS.
2. Keep PostgreSQL and the backend on private networks. Only the frontend/ingress should be public.
3. Route same-origin `/api/` traffic to the backend and set trusted forwarded headers at one proxy
   boundary. Do not expose PostgreSQL, management ports, or Supabase administrative endpoints.
4. Use `/actuator/health/liveness` and `/actuator/health/readiness` for orchestration probes. Do not
   expose other Actuator endpoints publicly.
5. Run at least two backend replicas only after verifying the platform supports rolling deployment
   with Flyway's migration lock. Never run an older application against an incompatible schema.
6. Apply CPU, memory, process, and ephemeral-storage limits; use a read-only root filesystem where
   the selected platform and image entrypoint support it.
7. Send application and ingress logs to access-controlled centralized storage with retention and
   alerting. Never log tokens, passwords, raw biometric material, or customer secrets.

## Release and rollback

The CI workflow must be green before release. Take or verify a recoverable database checkpoint,
review pending Flyway migrations, deploy to a non-production environment, and run guest ordering
plus staff completion smoke tests. Production rollout should be gradual where supported.

Application rollback is allowed only while the previous image remains schema-compatible. Database
rollback uses the documented recovery procedure rather than editing or deleting an applied Flyway
migration. See [`backup-restore.md`](backup-restore.md).
