# Continuous Integration

The GitHub Actions workflow at `.github/workflows/ci.yml` is the merge gate for every push and
pull request. It grants read-only repository access and cancels superseded runs on the same ref.

## Required jobs

| Job | Gate |
| --- | --- |
| Backend verification | Java 21 build, all unit and PostgreSQL Testcontainers integration tests, Flyway validation, and packaging through `./mvnw verify`. |
| Frontend verification | Frozen dependency install, high/critical dependency audit, Vitest accessibility/component tests, generated OpenAPI drift check, TypeScript, ESLint, the Vite production build, and the static Storybook catalog. |
| Infrastructure verification | Node tests for local Supabase Auth key generation and Kong Auth throttling policy. |
| Container and browser release gate | Build and boot the complete Compose stack, then run guest checkout in desktop and mobile Chromium with WCAG, responsive-layout, console/network, and performance-budget assertions. |

The release-candidate job builds images but does not publish them or deploy the application. Registry
credentials and deployment authority are intentionally absent from pull-request CI.

## Local equivalents

Run the same checks before pushing:

```bash
cd backend
./mvnw verify

cd ../frontend
pnpm install --frozen-lockfile
pnpm audit --audit-level high
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm build-storybook
pnpm exec playwright install chromium

cd ..
node --test infra/supabase/generate-local-auth-keys.test.mjs \
  infra/supabase/kong/kong.test.mjs
docker compose up --detach --build --wait

cd frontend
pnpm e2e
```

The backend suite requires a Docker daemon because integration tests run against disposable
PostgreSQL 18 containers.
