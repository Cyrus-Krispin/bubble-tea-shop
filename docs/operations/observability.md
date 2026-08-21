# Observability and Incident Signals

Production runs use the Spring `production` profile. It fails startup when database or Supabase
identity configuration is absent and emits Elastic Common Schema JSON logs to stdout. Every HTTP
response includes `X-Request-Id`; a safe incoming value is preserved, otherwise Spring creates one.
The same value appears as `request.id` in structured logs so ingress, frontend reports, and backend
events can be correlated without logging tokens or request bodies.

## Health and metrics

| Endpoint | Use |
| --- | --- |
| `/actuator/health/liveness` | Restart only when the process itself cannot make progress. |
| `/actuator/health/readiness` | Remove the instance from service while dependencies or startup state are unavailable. |
| `/actuator/prometheus` | Private-network scrape of JVM, process, HTTP server, HikariCP, and database-pool metrics. |

Only health endpoints may be routed through a public load balancer. Keep the Prometheus endpoint
on the backend's private network and restrict it with platform network policy. Health details stay
hidden. Do not expose the general Actuator surface.

## Minimum dashboards

- Request rate, 4xx/5xx rate, and p50/p95/p99 latency by normalized route and method.
- Backend readiness, replica restarts, CPU, memory, GC pause, thread count, and file descriptors.
- Hikari active, idle, pending, timeout, and maximum connections.
- PostgreSQL connections, transaction rate, lock waits, deadlocks, storage, replication lag, and
  backup age from the database provider.
- Nginx 4xx/5xx rate and latency, plus Supabase Auth availability and error rate.

Never attach organization IDs, location IDs, account IDs, order IDs, request IDs, email addresses,
or arbitrary URLs as metric labels. Those values are high-cardinality and some are customer data;
keep scoped identifiers in access-controlled logs only.

## Initial alerts

Tune thresholds after collecting a representative baseline. Before launch, configure at least:

1. Readiness unavailable for 5 minutes or more than one replica unavailable for 2 minutes.
2. 5xx responses above 2% for 5 minutes, excluding health probes.
3. p95 API latency above 1 second for 10 minutes.
4. Database connection pool pending requests or timeouts for 2 minutes.
5. PostgreSQL storage above 80%, sustained lock waits, any deadlock increase, or replication lag
   outside the provider's recovery objective.
6. Latest successful backup older than the documented RPO, or any failed backup/restore drill.
7. Repeated order shortage conflicts as an operational warning, not an application outage.

## Incident handling

Start with the alert timestamp and a request ID, then correlate ingress and backend logs. Confirm
whether the fault is global, organization-scoped, or location-scoped without copying raw tokens or
customer payloads into tickets. Record mitigation, affected interval, recovery evidence, and a
follow-up owner. Database recovery follows [`backup-restore.md`](backup-restore.md).
