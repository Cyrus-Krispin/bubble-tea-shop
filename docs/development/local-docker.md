# Local Docker development

The development runtime is intentionally local-only. One Compose project starts:

- Supabase Postgres from the official `supabase/postgres` image;
- Supabase Auth (GoTrue) from the official `supabase/gotrue` image;
- the Spring Boot modular monolith; and
- a React/Vite SPA served by Nginx with guest ordering and separate customer/staff authentication.

There is no standalone generic PostgreSQL container and no hosted Supabase project. Postgres is
the single database in the stack, and Flyway in the Spring backend remains the authority for the
application schema. GoTrue owns only its Supabase Auth schema.

## Prerequisites and first start

Install and start Docker Desktop, Colima, or another Docker-compatible runtime. Then run:

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

Do not use `--build` offline after changing a Dockerfile or dependency manifest unless the required
artifacts are already cached.

## Local endpoints

| Service | URL | Purpose |
| --- | --- | --- |
| Frontend workspace | <http://localhost:4173> | Guest ordering, customer accounts, and staff sign-in SPA |
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

Change `POSTGRES_PASSWORD`, `JWT_SECRET`, and `JWT_KEYS` before sharing an environment. Never
commit real user data, production credentials, OAuth client secrets, tokens, or an edited `.env`.
Email accounts are auto-confirmed because no SMTP service is part of this focused local stack.
The local Auth service enforces the same eight-character password minimum shown by the customer
registration form; browser validation is only usability feedback, not the security boundary.
Self-service signup is for customers only: application roles still require a server-owned
organization membership created by the future owner/bootstrap workflow. Kong permits Auth browser
requests only from the known local frontend origins on ports `4173` and `5173`.

The Supabase image tags are copied from a tested official Docker Compose release. Update the
Postgres and GoTrue tags together only after reviewing Supabase release notes and running the full
backend verification suite.
