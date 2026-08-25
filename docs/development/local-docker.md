# Local Docker development

The development runtime is intentionally local-only. One Compose project starts:

- Supabase Postgres from the official `supabase/postgres` image;
- Supabase Auth (GoTrue) from the official `supabase/gotrue` image;
- Supabase Studio and Postgres Meta for local database and Auth administration;
- the Spring Boot modular monolith; and
- a React/Vite SPA served by Nginx with guest ordering and separate customer/staff authentication.

There is no standalone generic PostgreSQL container and no hosted Supabase project. Postgres is
the single database in the stack, and Flyway in the Spring backend remains the authority for the
application schema. GoTrue owns only its Supabase Auth schema.

## Prerequisites and first start

Install and start Docker Desktop. Wait until its engine is running, then verify that the Docker CLI
targets Docker Desktop:

```bash
docker context use desktop-linux
docker info --format '{{.OperatingSystem}}'
```

The second command must print `Docker Desktop`. Then run:

```bash
cp .env.example .env
node infra/supabase/generate-local-auth-keys.mjs >> .env
docker compose up --build
```

The first start requires internet access while Docker pulls the pinned base and Supabase images
and Maven downloads backend dependencies. Later starts can run offline after those images and
build layers are present:

```bash
docker compose up
```

For an existing checkout created before Studio was added, rerun the generator once and append its
fresh signing material and Studio keys to the ignored `.env` file before starting Compose:

```bash
node infra/supabase/generate-local-auth-keys.mjs >> .env
```

The new values supersede the earlier generated entries. This rotates local signing keys, so sign
in again if an existing browser session stops working.

Do not use `--build` offline after changing a Dockerfile or dependency manifest unless the required
artifacts are already cached.

## Migrating from Colima

Docker Desktop and Colima use separate Linux virtual machines. Their containers, images, networks,
and named volumes are not shared even though both runtimes use the same Docker CLI. Check the old
runtime before cutting over:

```bash
docker --context colima compose ps
```

If the project is running there, stop it without deleting its named volumes:

```bash
docker --context colima compose down
```

Start Docker Desktop, select its context, and verify the engine before starting the project again:

```bash
docker context use desktop-linux
docker info --format '{{.OperatingSystem}}'
docker compose up --build
```

This uses Docker Desktop's own database volume and never reuses the Colima volume. If the Colima
database contains local data that must be retained, do not run `docker compose down --volumes`,
delete the Colima profile, or uninstall Colima. Create and verify a logical backup and restore
before decommissioning the old runtime; the
[backup and restore guide](../operations/backup-restore.md) describes the application schema
workflow. Supabase Auth data is outside that logical backup, so preserving local accounts requires
a separate Auth-aware migration or creating fresh local accounts after cutover. Keeping the stopped
Colima profile provides a rollback path until the Docker Desktop stack is validated.

## Local endpoints

| Service | URL | Purpose |
| --- | --- | --- |
| Frontend workspace | <http://localhost:4173> | Guest ordering, customer accounts, and staff sign-in SPA |
| Supabase Studio | <http://localhost:54323> | Local table editor, SQL editor, and Auth administration |
| Swagger UI | <http://localhost:8080/swagger-ui.html> | Interactive documentation for the Spring application API |
| OpenAPI JSON | <http://localhost:8080/v3/api-docs> | Runtime-generated OpenAPI 3.1 contract |
| Spring health | <http://localhost:8080/actuator/health> | Backend and database readiness |
| Supabase Auth health | <http://localhost:8000/auth/v1/health> | Local GoTrue readiness through Kong |
| PostgreSQL | `localhost:54322` | Optional host access for database tools |

Inside Compose, services use DNS names instead of host ports: Spring connects to `db:5432` and
retrieves public signing keys through `kong:8000/auth/v1/.well-known/jwks.json`. GoTrue signs
tokens with the local asymmetric key and issues them with
`http://localhost:8000/auth/v1` as the exact issuer. No hosted URL, remote API key, or online JWKS
endpoint is required at runtime.

Check the stack without changing data:

```bash
docker compose ps
curl --fail http://localhost:4173/health
curl --fail http://localhost:54323/api/platform/profile
curl --fail http://localhost:8080/swagger-ui.html
curl --fail http://localhost:8080/v3/api-docs
curl --fail http://localhost:8080/actuator/health
curl --fail http://localhost:8000/auth/v1/health
```

Stop containers while preserving the database volume:

```bash
docker compose down
```

## Configuration and security boundary

Copy `.env.example` to the ignored `.env` file, then run the included generator once to append a
fresh `JWT_SECRET` and private `JWT_KEYS` value. The generator writes secrets only to standard
output so they can be redirected into the ignored `.env`; it never writes or commits them itself.
Every port mapping binds only to `127.0.0.1`; do not expose this stack to another machine or use it
as a production deployment.

Change `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_KEYS`, `ANON_KEY`, `SERVICE_ROLE_KEY`, and
`PG_META_CRYPTO_KEY` before sharing an environment. Never commit real user data, production
credentials, OAuth client secrets, tokens, or an edited `.env`.
Email accounts are auto-confirmed because no SMTP service is part of this focused local stack.
The local Auth service enforces the same eight-character password minimum shown by the customer
registration form; browser validation is only usability feedback, not the security boundary.
Self-service signup is for customers only: application roles still require a server-owned
organization membership created by the owner bootstrap command below. Kong permits Auth browser
requests only from the known local frontend origins on ports `4173` and `5173`.

## Bootstrap the first owner

Register the owner through the normal account screen first so Supabase Auth and Spring provision
the application account. Obtain that identity's UUID (`sub` in its verified access token) and the
target organization UUID, then run a one-shot backend container:

```bash
docker compose run --rm \
  -e OWNER_BOOTSTRAP_ENABLED=true \
  -e OWNER_BOOTSTRAP_AUTH_SUBJECT=<uuid> \
  -e OWNER_BOOTSTRAP_ORGANIZATION_ID=<uuid> \
  backend --spring.main.web-application-type=none
```

The command succeeds if it creates the active owner membership or if that exact active owner
membership already exists. It fails closed for missing or disabled accounts, missing organizations,
manager memberships, and inactive memberships. It never creates an Auth identity, promotes a role,
or reactivates access. Remove the three bootstrap variables after the one-shot command; never place
them in a committed environment file or enable bootstrap on the long-running backend service.

The Supabase image tags are copied from a tested official Docker Compose release. Update the
Postgres, GoTrue, Studio, and Postgres Meta tags together only after reviewing Supabase release
notes and running the full backend verification suite.
