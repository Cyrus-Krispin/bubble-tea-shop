# Observability and Incident Signals

Production runs use the Spring `production` profile. It fails startup when database or Supabase
identity configuration is absent and emits Elastic Common Schema JSON logs to stdout. Every HTTP
response includes `X-Request-Id`; a safe incoming value is preserved, otherwise Spring creates one.
The same value appears as `request.id` in structured logs so ingress, frontend reports, and backend
events can be correlated without logging tokens or request bodies.

Spring creates W3C-compatible spans through Micrometer and OpenTelemetry. Trace export is disabled
unless `OTEL_TRACING_ENABLED=true`; production should send OTLP/HTTP to an access-controlled
collector using `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`. The default sample probability is 10% and is
configured with `OTEL_TRACES_SAMPLER_ARG`. Trace and span IDs are added to the structured logging
context, but business/customer identifiers must not be attached as span attributes.

## Health and metrics

| Endpoint | Use |
| --- | --- |
| `/actuator/health/liveness` | Restart only when the process itself cannot make progress. |
| `/actuator/health/readiness` | Remove the instance from service while dependencies or startup state are unavailable. |
| `/actuator/prometheus` | Private-network scrape of JVM, process, HTTP server, HikariCP, and database-pool metrics. |

Only health endpoints may be routed through a public load balancer. Keep the Prometheus endpoint
on the backend's private network and restrict it with platform network policy. Health details stay
hidden. Do not expose the general Actuator surface.

## Local dashboard

The local Compose stack scrapes Spring every 15 seconds, retains metrics for seven days, and opens
the provisioned `Bubble Tea Shop · System Overview` dashboard at <http://localhost:3000>. It shows:

- backend scrape status, request rate, 5xx rate, and p50/p95/p99 latency;
- request throughput by normalized route and responses by outcome;
- process and system CPU, JVM memory, GC overhead, thread states, and file descriptors;
- Logback event rate by level; and
- HikariCP utilization, active/idle connections, pending threads, and timeouts.

The local dashboard intentionally covers signals already emitted by Spring. PostgreSQL internals,
container restarts, Nginx latency, Supabase Auth request metrics, backup age, logs, and traces need
their own exporters or telemetry backends before they can appear in Grafana. Prometheus is available
at <http://localhost:9090> for target inspection and PromQL exploration.

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

Follow [`incident-response.md`](incident-response.md). Start with the alert timestamp and a request
or trace ID, then correlate ingress, backend, and database signals without copying raw tokens or
customer payloads into tickets. Database recovery follows [`backup-restore.md`](backup-restore.md).
