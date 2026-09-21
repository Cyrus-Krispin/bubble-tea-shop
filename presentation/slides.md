---
layout: none
theme: default
title: Bubble Tea Shop — the app and the workflow
info: A six-slide project showcase mock
aspectRatio: 16/9
colorSchema: light
duration: 10min
transition: fade
---

<div class="slide cover">
  <p class="eyebrow">PROJECT SHOWCASE</p>
  <h1>Bubble Tea<br><span>Shop</span></h1>
  <div class="cover-arrow" aria-hidden="true">↝</div>
  <div class="cup-doodle" aria-hidden="true"><div class="straw"></div><div class="lid"></div><div class="cup-body"><i></i><i></i><i></i></div></div>
  <p class="cover-caption">the app & how I built it</p>
</div>

<!--
Opening: introduce the product. If a short demo video is added later, play it after this cover, then return to the complexity slide. The deck currently has no video.
-->

---
layout: none
---

<div class="slide complexity">
  <p class="eyebrow">01 / UNDER THE CUP</p>
  <h2>Bubble tea sounds <span>simple?</span></h2>
  <div class="complexity-stats">
    <div v-click><strong>35</strong><small>schema tables*</small></div>
    <div v-click><strong>20</strong><small>Flyway migrations</small></div>
    <div v-click><strong>4</strong><small>backend modules</small></div>
  </div>
  <div class="auth-sketch" v-click>
    <div class="auth-row"><span class="auth-person">◉ guest</span><b>→</b><span>public catalog + order API</span></div>
    <div class="auth-row"><span class="auth-person">◉ customer / staff</span><b>→</b><span>Supabase Auth</span><b>→</b><span>JWT + JWKS</span><b>→</b><span>DB role + location scope</span></div>
  </div>
  <p class="tiny-note">* Includes one unused legacy refresh-session table.</p>
</div>

<!--
After the optional demo, pause on the rhetorical question. The 35 count comes from CREATE TABLE statements in V1–V20, and includes an unused legacy refresh_session table. Supabase Auth owns password and browser-session lifecycle. React sends a bearer token; Spring checks the token against the local JWKS and then resolves current account, membership, role, and assigned location from PostgreSQL. Guests can browse and order publicly; signing up as a customer never grants staff access. Four modules: identity, catalog, inventory, ordering.
-->

---
layout: none
---

<div class="slide cloud crowded-cloud">
  <p class="eyebrow">02 / WHAT ACTUALLY SHIPPED</p>
  <h2>And then it <span>grew...</span></h2>
  <div class="feature-wall" aria-label="Implemented Bubble Tea Shop capabilities">
    <span class="group-marker customer" v-click="1">CUSTOMER ↗</span>
    <span v-click="1">two-shop picker</span><span v-click="1">location menus</span><span v-click="1">SGD / MYR / CNY</span><span v-click="1">custom drinks</span><span v-click="1">sugar + ice</span><span v-click="1">milk + toppings</span><span v-click="1">clear optional choice</span><span v-click="1">guest checkout</span><span v-click="1">cash pickup</span><span v-click="1">Stripe-hosted card</span><span v-click="1">checkout recovery</span><span v-click="1">customer accounts</span><span v-click="1">session expiry</span><span v-click="1">order history</span><span v-click="1">receipts</span><span v-click="1">order again</span><span v-click="1">favorite drink</span><span v-click="1">5% favorite discount</span>
    <span class="group-marker staff" v-click="2">STAFF ↗</span>
    <span v-click="2">ingredient editor</span><span v-click="2">recipe versions</span><span v-click="2">menu + options</span><span v-click="2">currency prices</span><span v-click="2">stock balances</span><span v-click="2">opening stock</span><span v-click="2">receipts + adjustments</span><span v-click="2">movement history</span><span v-click="2">retry-safe stock</span><span v-click="2">order queue</span><span v-click="2">cash collection</span><span v-click="2">counter orders</span><span v-click="2">card reconciliation</span><span v-click="2">refunds</span><span v-click="2">shop creation</span><span v-click="2">manager access</span><span v-click="2">audit timeline</span><span v-click="2">cash-flow dashboard</span><span v-click="2">paid expenses</span>
    <span class="group-marker insight" v-click="3">INTELLIGENCE ↗</span>
    <span v-click="3">consumption forecasts</span><span v-click="3">low-stock alerts</span><span v-click="3">reorder planning</span><span v-click="3">no-oversell completion</span><span v-click="3">stock reservations</span><span v-click="3">idempotent orders</span>
    <span class="group-marker ops" v-click="4">ENGINEERING + OPS ↗</span>
    <span v-click="4">server-owned pricing</span><span v-click="4">role + location scope</span><span v-click="4">generated OpenAPI types</span><span v-click="4">Testcontainers</span><span v-click="4">Playwright desktop + mobile</span><span v-click="4">WCAG checks</span><span v-click="4">Storybook</span><span v-click="4">Docker Compose</span><span v-click="4">health probes</span><span v-click="4">Prometheus metrics</span><span v-click="4">Grafana dashboard</span><span v-click="4">JSON logs</span><span v-click="4">request IDs</span><span v-click="4">OpenTelemetry hooks</span><span v-click="4">backup / restore drills</span><span v-click="4">incident runbooks</span>
  </div>
</div>

<!--
This slide is intentionally overloaded. Reveal customer, staff, intelligence, and engineering/operations in four waves. Do not read every term: invite the audience to scan for the surprising ones. The supporting inventory in presentation/research.md maps the terms to implementation evidence. Stripe-hosted card checkout depends on merchant configuration. OpenTelemetry export is optional; the local Grafana/Prometheus dashboard is implemented. Runbooks exist, but do not imply that a production deployment is live.
-->

---
layout: none
---

<div class="slide technical-flow">
  <p class="eyebrow">03 / THE AGENT WORKFLOW</p>
  <h2>How a feature <span>moves.</span></h2>
  <div class="technical-chain">
    <div v-click><b>01</b><strong>SPEC</strong><span>acceptance<br>+ invariants</span><small>spec-driven-development</small></div>
    <i v-click>→</i>
    <div v-click><b>02</b><strong>RED → GREEN</strong><span>JUnit / Vitest<br>first, then code</span><small>test-driven-development</small></div>
    <i v-click>→</i>
    <div v-click><b>03</b><strong>THIN SLICE</strong><span>DB → Spring<br>→ typed React</span><small>incremental-implementation</small></div>
    <i v-click>→</i>
    <div v-click><b>04</b><strong>REAL BROWSER</strong><span>Compose + Playwright<br>desktop / mobile</span><small>browser-testing-with-devtools</small></div>
    <i v-click>→</i>
    <div v-click><b>05</b><strong>REVIEW + CI</strong><span>diff + security<br>+ GitHub gates</span><small>code-review-and-quality</small></div>
  </div>
  <p class="flow-footnote" v-click>CI = backend + frontend + OpenAPI drift + container boot + browser checkout</p>
</div>

<!--
Technical workflow: (1) A feature spec defines acceptance and invariants. The spec-driven-development skill structures it. (2) Test-driven-development drives failing then passing tests: JUnit/Testcontainers for Spring/PostgreSQL and Vitest for frontend behavior. (3) Incremental-implementation keeps changes in small vertical slices across migrations, Spring API, generated OpenAPI types and React. (4) The real Compose stack is exercised in desktop and mobile Playwright; browser-testing-with-devtools is an agent skill for interactive inspection, not the name of the CI runner. (5) Code-review-and-quality checks correctness, architecture, security and readability; GitHub Actions runs the repository gates. Avoid implying the skill files themselves execute tests; they guide the agent's actions.
-->

---
layout: none
---

<div class="slide technical-guardrails">
  <p class="eyebrow">04 / WHY THE LOOP HOLDS</p>
  <h2>What constrains <span>the agent?</span></h2>
  <div class="guardrail-map">
    <div v-click><b>AGENTS.md</b><span>module owners<br>server-owned roles<br>price + stock<br>no fake app data</span></div>
    <div v-click><b>FLYWAY + PG</b><span>new V migration<br>immutable history<br>FKs + transactions<br>Hibernate validate</span></div>
    <div v-click><b>OPENAPI</b><span>Spring contract<br>generated TS types<br>drift fails CI</span></div>
    <div v-click><b>VERIFICATION</b><span>Testcontainers<br>Vitest + axe<br>Playwright + CI</span></div>
  </div>
  <p class="guardrail-link" v-click>spec → implementation → evidence → review ↺</p>
</div>

<!--
Tie each guardrail back to the workflow: AGENTS.md sets permanent architecture and security rules; feature specs define acceptance for each change. The database uses append-only Flyway versioned migrations, PostgreSQL foreign keys and transactions, and Hibernate `ddl-auto=validate` to catch mapping drift. OpenAPI catches backend/frontend contract drift. Testcontainers, Vitest/axe, browser checks, and CI supply independent evidence. The skills guide an agent, while the executable gates check its output.
-->

---
layout: none
---

<div class="slide next">
  <p class="eyebrow">05 / STILL HUMAN WORK</p>
  <h2>AI is fast.<br><span>Judgment is mine.</span></h2>
  <div class="next-list">
    <div v-click><b>✦</b><strong>UI taste</strong><small>Does it feel clear?</small></div>
    <div v-click><b>◎</b><strong>Test quality</strong><small>Did we test the right thing?</small></div>
    <div v-click><b>✂</b><strong>Scope</strong><small>What should we leave out?</small></div>
  </div>
</div>

<!--
About one minute. End honestly: AI makes it easy to create more code, but visual quality still requires taste, green tests can repeat a flawed assumption, and product scope needs deliberate cuts. The old closing tagline has been removed as requested.
-->
