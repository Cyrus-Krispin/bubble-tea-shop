import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL(
  "./grafana/dashboards/bubble-tea-system-overview.json",
  import.meta.url,
);
const prometheusPath = new URL("./prometheus/prometheus.yml", import.meta.url);
const datasourcePath = new URL(
  "./grafana/provisioning/datasources/prometheus.yml",
  import.meta.url,
);

const dashboard = JSON.parse(await readFile(dashboardPath, "utf8"));
const prometheus = await readFile(prometheusPath, "utf8");
const datasource = await readFile(datasourcePath, "utf8");

test("provisions a stable system dashboard with unique panels", () => {
  assert.equal(dashboard.uid, "bubble-tea-system-overview");
  assert.equal(dashboard.title, "Bubble Tea Shop · System Overview");
  assert.equal(dashboard.refresh, "15s");

  const panelIds = dashboard.panels.map((panel) => panel.id);
  assert.equal(new Set(panelIds).size, panelIds.length);
  assert.ok(dashboard.panels.length >= 20);
});

test("uses the provisioned Prometheus datasource for every metric panel", () => {
  const metricPanels = dashboard.panels.filter((panel) => panel.targets);

  assert.ok(metricPanels.length >= 15);
  for (const panel of metricPanels) {
    assert.equal(panel.datasource?.uid, "prometheus", panel.title);
    assert.ok(panel.targets.every((target) => target.expr), panel.title);
  }

  assert.match(datasource, /uid: prometheus/);
  assert.match(datasource, /url: http:\/\/prometheus:9090/);
});

test("covers customer-impact, JVM, and connection-pool signals", () => {
  const expressions = dashboard.panels
    .flatMap((panel) => panel.targets ?? [])
    .map((target) => target.expr)
    .join("\n");

  for (const metric of [
    "http_server_requests_seconds_count",
    "http_server_requests_seconds_bucket",
    "process_cpu_usage",
    "jvm_memory_used_bytes",
    "jvm_gc_overhead",
    "jvm_threads_states_threads",
    "logback_events_total",
    "hikaricp_connections_active",
    "hikaricp_connections_pending",
    "hikaricp_connections_timeout_total",
  ]) {
    assert.match(expressions, new RegExp(metric), metric);
  }
});

test("keeps customer and request identifiers out of metric labels", () => {
  const expressions = dashboard.panels
    .flatMap((panel) => panel.targets ?? [])
    .map((target) => target.expr)
    .join("\n");

  assert.doesNotMatch(
    expressions,
    /(?:organization|location|account|order|request|ingredient|email)_?id\s*=/i,
  );
});

test("scrapes the private Spring Actuator Prometheus endpoint", () => {
  assert.match(prometheus, /job_name: bubble-tea-backend/);
  assert.match(prometheus, /metrics_path: \/actuator\/prometheus/);
  assert.match(prometheus, /- backend:8080/);
  assert.match(prometheus, /scrape_interval: 15s/);
});
