# Continuous Integration

The GitHub Actions workflow at `.github/workflows/ci.yml` is the merge gate for every push and
pull request. It grants read-only repository access and cancels superseded runs on the same ref.

## Required jobs

| Job | Gate |
| --- | --- |
| Backend verification | Java 21 build, all unit and PostgreSQL Testcontainers integration tests, Flyway validation, and packaging through `./mvnw verify`. |
| Frontend verification | Frozen dependency install, Vitest accessibility/component tests, generated OpenAPI drift check, TypeScript, ESLint, the Vite production build, and the static Storybook catalog. |
| Infrastructure verification | Node tests for local Supabase Auth key generation. |
| Container builds | Backend and frontend multi-stage Docker images, only after all preceding verification jobs pass. |

The container job builds images but does not publish them or deploy the application. Registry
credentials and deployment authority are intentionally absent from pull-request CI.

## Local equivalents

Run the same checks before pushing:

```bash
cd backend
./mvnw verify

cd ../frontend
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm build-storybook

cd ..
node --test infra/supabase/generate-local-auth-keys.test.mjs
docker build --tag bubble-tea-backend:local backend
docker build --build-arg VITE_SUPABASE_URL=http://localhost:8000 \
  --tag bubble-tea-frontend:local frontend
```

The backend suite requires a Docker daemon because integration tests run against disposable
PostgreSQL 18 containers.
