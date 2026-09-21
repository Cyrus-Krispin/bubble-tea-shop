# Continuous Integration

The GitHub Actions workflow at `.github/workflows/ci.yml` is the merge gate for pushes and pull
requests targeting `main`. It grants read-only repository access and cancels superseded runs on
the same ref.

## Change-aware jobs

The always-running change detector classifies every file changed across the complete pull request.
It then starts only the affected verification jobs. A skipped job is intentional and means that
the pull request did not change its owned paths.

| Job | Trigger | Gate |
| --- | --- | --- |
| Backend verification | `backend/**` or the generated OpenAPI contract | Java 21 build, all unit and PostgreSQL Testcontainers integration tests, Flyway validation, and packaging through `./mvnw verify`. |
| Frontend verification | `frontend/**` or the generated OpenAPI contract | Frozen dependency install, high/critical dependency audit, Vitest accessibility/component tests, generated OpenAPI drift check, TypeScript, ESLint, the Vite production build, and the static Storybook catalog. |
| Presentation verification | `presentation/**` | Frozen dependency install and the Slidev production build. |
| Infrastructure verification | `infra/**`, `compose.yaml`, or `.env.example` | Node tests for local Supabase Auth bootstrap and key generation plus Kong Auth throttling policy. |
| Container and browser release gate | Any backend, frontend, presentation, infrastructure, Compose, environment-example, OpenAPI-contract, or Docker-build-context change | Build and boot the complete Compose stack, check the presentation health endpoint and bundled video, then run guest checkout in desktop and mobile Chromium with WCAG, responsive-layout, console/network, and performance-budget assertions. |

Changes to CI routing run every gate so that the routing behavior verifies itself. Documentation-only
and other unrelated changes run the change detector but skip the expensive application gates.

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

cd ../presentation
pnpm install --frozen-lockfile
pnpm build

cd ..
node --test infra/supabase/generate-local-auth-keys.test.mjs \
  infra/supabase/kong/kong.test.mjs
docker compose up --detach --build --wait
curl --fail http://localhost:4177/health
curl --fail --head http://localhost:4177/bubble-tea-shop-demo-schema.mp4

cd frontend
pnpm e2e
```

The backend suite requires a Docker daemon because integration tests run against disposable
PostgreSQL 18 containers.
