# Homelab deployment task list

Use [the deployment plan](homelab-deployment-plan.md) for rationale, dependencies, and acceptance criteria. No host changes have been made.

## Checkpoint 1: Access and baseline

- [ ] Restore key-based SSH through Tailscale and verify the host key and recovery path.
- [ ] Record private inventory: daemon/context, Compose/Tailscale versions, listeners, capacity, firewall, existing services, and backup destination.
- [ ] Reserve non-conflicting ports and a dedicated deployment directory.

## Checkpoint 2: Deployable configuration

- [ ] Create homelab Compose configuration without local fixture bootstrap jobs.
- [ ] Put frontend, Spring API, and Auth on one canonical HTTPS origin; parameterize issuer, redirects, CSP, and CORS.
- [ ] Add frontend `/auth/v1/` proxy and HTTPS-issuer backend validation tests.
- [ ] Keep database, backend, Kong, monitoring, and admin services private; validate the rendered Compose config.
- [ ] Run backend verification and frontend test, typecheck, lint, and build.

## Checkpoint 3: Host operations

- [ ] Document and dry-run exact-commit SSH clone/fetch/deploy commands.
- [ ] Bootstrap one real owner through the audited one-time flow; disable long-running bootstrap.
- [ ] Implement encrypted off-host backup for both app and Auth data; complete an isolated restore drill.
- [ ] Document restart, monitoring, and schema-compatible rollback.

## Checkpoint 4: Ingress and verification

- [ ] Configure tailnet policy, MagicDNS HTTPS Serve, IP-to-HTTPS redirect, and presentation endpoint.
- [ ] Verify no Funnel, public port forward, or unintended LAN exposure.
- [ ] Smoke-test catalog, guest order, customer sign-in, staff completion, inventory, presentation, and monitoring from the intended access paths.
- [ ] Reboot and repeat health checks; verify a restored Auth login and representative application data.
- [ ] Review/commit/push the implementation increment separately and report its SHA and verification.
