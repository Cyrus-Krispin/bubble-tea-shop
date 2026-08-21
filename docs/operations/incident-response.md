# Incident Response Runbook

This runbook applies to production availability, security, payment, order-integrity, and data-loss
events. The incident record must contain timestamps, decisions, owners, and links to access-controlled
evidence. Never paste credentials, tokens, full customer payloads, or database exports into it.

## Severity and authority

| Severity | Definition | Response target |
| --- | --- | --- |
| SEV-1 | Confirmed data loss/exposure, unsafe order or payment behavior, or complete service outage. | Page incident commander and operations immediately; update stakeholders every 30 minutes. |
| SEV-2 | Material degradation, repeated failures, or one location unable to operate without a safe workaround. | Assign commander within 15 minutes; update hourly. |
| SEV-3 | Limited defect with a safe workaround and no data-integrity or security risk. | Triage in business hours and assign an owner. |

The incident commander owns severity, roles, timeline, and the final restore/rollback decision. The
operations lead executes platform changes; the application lead diagnoses behavior; the
communications lead posts approved updates. One person may hold multiple roles for a small event,
but the commander does not perform an unreviewed destructive database action.

## First 15 minutes

1. Open the incident record and note detection time, reporter, current UTC time, affected surface,
   suspected start, and severity.
2. Confirm the symptom from health, RED metrics, ingress, and one safe read-only user journey. Use a
   request or trace ID to correlate signals. Do not repeatedly submit orders to probe an outage.
3. Freeze releases and owner-bootstrap jobs. Preserve logs, deployment digests, configuration
   versions, alert snapshots, and relevant audit events.
4. Establish scope: global, organization, location, identity, catalog, ordering, inventory, or
   database. Treat unexplained authorization bypass, cross-tenant access, or incorrect inventory
   deduction as SEV-1.
5. Choose the safest containment: drain unhealthy replicas, disable the affected ingress route,
   pause order writes, revoke a compromised credential, or roll back a compatible application
   image. Record the exact change and approver.

## Diagnosis and containment

- Compare the active and previous image digests, Flyway schema version, configuration revision,
  dependency health, database locks/connections, and recent staff audit events.
- Use structured logs and traces by timestamp, normalized route, response status, and request ID.
  Do not add order, account, email, organization, or location IDs as metric labels.
- For suspected credential exposure, rotate the credential at its authority, revoke sessions where
  supported, and audit access before restoring traffic. Never reuse the exposed value.
- For suspected data exposure, stop further access, preserve evidence, notify the designated privacy
  and legal contacts, and do not make speculative public claims.
- For unsafe ordering or inventory behavior, fence write endpoints while keeping health and safe
  staff reads available when possible. Reconcile immutable order, payment, movement, and audit rows
  before reopening writes.

## Recovery and rollback

1. Prefer a forward application fix when schema compatibility is uncertain. Roll back by immutable
   image digest only when the previous binary is compatible with the current Flyway schema.
2. Never edit, delete, or mark an applied Flyway migration as successful to force rollback.
3. Database restore requires the recovery checklist and two-person confirmation in
   [`backup-restore.md`](backup-restore.md). Fence writes and record the recovery point objective
   before restore.
4. Validate readiness, error rate, latency, Auth, guest catalog, one idempotent guest order, staff
   order detail/completion, exact inventory deduction, and audit visibility in a non-production or
   isolated verification path before normal traffic resumes.
5. Restore traffic gradually where the platform supports it. Watch the original alert, 5xx rate,
   p95 latency, database saturation, Auth failures, order shortages, and rate-limit rejections for
   at least 30 minutes. Record the recovery time and evidence.

If validation fails, reapply containment and continue the incident; do not declare recovery based
only on green health probes.

## Communications and closure

Each update states confirmed impact, affected interval, current mitigation, remaining risk, and the
next update time. Separate facts from hypotheses. Customer-facing messages disclose only reviewed
information and never internal identifiers or security details that increase risk.

Close the incident only after service and data-integrity validation, alert recovery, stakeholder
notification, and assignment of every follow-up. Complete a blameless review within five business
days for SEV-1/2 incidents: timeline, root cause, contributing conditions, detection gaps, customer
impact, recovery performance against RTO/RPO, and concrete corrective actions with owners and due
dates. Test the changed runbook or alert in the next scheduled drill.
