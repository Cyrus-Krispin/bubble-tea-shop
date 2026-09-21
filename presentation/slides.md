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
  <h2>One drink. <span>Many moving parts.</span></h2>
  <div class="order-sketch" aria-label="One drink order depends on shop, recipe, price, stock, payment, and staff handoff">
    <div class="order-cup" v-click="1" aria-hidden="true"><div class="straw"></div><div class="lid"></div><div class="cup-body"><i></i><i></i><i></i></div></div>
    <p class="one-drink" v-click="1">“One bubble tea,<br>please.”</p>
    <span class="order-arrow" v-click="2" aria-hidden="true">↝</span>
    <div class="order-decisions">
      <div v-click="2"><b>⌂</b><span>Which shop?</span></div>
      <div v-click="2"><b>✎</b><span>Which recipe?</span></div>
      <div v-click="3"><b>$</b><span>What price?</span></div>
      <div v-click="3"><b>▦</b><span>Enough ingredients?</span></div>
      <div v-click="4"><b>◇</b><span>How to pay?</span></div>
      <div v-click="4"><b>✓</b><span>Who prepares it?</span></div>
    </div>
  </div>
  <p class="order-point" v-click="5">Every answer has to agree before the drink reaches the counter.</p>
</div>

<!--
After the optional demo, use everyday language: the customer sees one drink, but the shop must agree on its location, recipe, price, ingredient availability, payment, and staff handoff. Reveal the decisions in three quick waves. The implementation underneath has 35 created application tables (including an unused legacy refresh-session table), 20 Flyway migrations, and four domain modules, but save those terms for the technical discussion if asked. Supabase Auth issues sessions; Spring resolves customer or staff permissions and assigned location. That distinction belongs on the guardrails slide, not in the opening story.
-->

---
layout: none
---

<div class="slide cloud crowded-cloud">
  <p class="eyebrow">02 / WHAT ACTUALLY SHIPPED</p>
  <h2>And then it <span>grew...</span></h2>
  <div class="feature-wall" aria-label="Implemented Bubble Tea Shop capabilities">
    <span class="tag-staff" v-click="2" style="left:45px;top:19px;font-size:17px;--twist:-4deg">refunds</span>
    <span class="tag-insight" v-click="3" style="left:116px;top:13px;font-size:15px;--twist:4deg">consumption forecasts</span>
    <span class="tag-ops" v-click="4" style="left:269px;top:19px;font-size:16px;--twist:3deg">generated OpenAPI types</span>
    <span class="tag-customer" v-click="1" style="left:445px;top:14px;font-size:17px;--twist:-2deg">Stripe-hosted card</span>
    <span class="tag-staff" v-click="2" style="left:594px;top:15px;font-size:16px;--twist:-2deg">order queue</span>
    <span class="tag-customer" v-click="1" style="left:689px;top:19px;font-size:16px;--twist:-2deg">guest checkout</span>
    <span class="tag-ops" v-click="4" style="left:71px;top:57px;font-size:17px;--twist:0deg">incident runbooks</span>
    <span class="tag-customer" v-click="1" style="left:214px;top:53px;font-size:17px;--twist:4deg">milk + toppings</span>
    <span class="tag-ops" v-click="4" style="left:342px;top:55px;font-size:19px;--twist:-3deg">Prometheus metrics</span>
    <span class="tag-ops" v-click="4" style="left:507px;top:50px;font-size:17px;--twist:-2deg">Playwright desktop + mobile</span>
    <span class="tag-ops" v-click="4" style="left:720px;top:56px;font-size:17px;--twist:-2deg">JSON logs</span>
    <span class="tag-staff" v-click="2" style="left:17px;top:95px;font-size:17px;--twist:3deg">movement history</span>
    <span class="tag-staff" v-click="2" style="left:152px;top:87px;font-size:17px;--twist:-1deg">manager access</span>
    <span class="tag-staff" v-click="2" style="left:273px;top:92px;font-size:19px;--twist:4deg">counter orders</span>
    <span class="tag-customer" v-click="1" style="left:406px;top:96px;font-size:17px;--twist:-1deg">clear optional choice</span>
    <span class="tag-customer" v-click="1" style="left:577px;top:96px;font-size:16px;--twist:-2deg">favorite drink</span>
    <span class="tag-staff" v-click="2" style="left:692px;top:90px;font-size:16px;--twist:-4deg">cash-flow dashboard</span>
    <span class="tag-ops" v-click="4" style="left:54px;top:130px;font-size:18px;--twist:0deg">request IDs</span>
    <span class="tag-staff" v-click="2" style="left:158px;top:128px;font-size:16px;--twist:2deg">currency prices</span>
    <span class="tag-staff" v-click="2" style="left:280px;top:128px;font-size:16px;--twist:-2deg">ingredient editor</span>
    <span class="tag-insight" v-click="3" style="left:415px;top:125px;font-size:17px;--twist:-3deg">stock reservations</span>
    <span class="tag-customer" v-click="1" style="left:565px;top:127px;font-size:19px;--twist:4deg">session expiry</span>
    <span class="tag-staff" v-click="2" style="left:697px;top:126px;font-size:16px;--twist:-2deg">recipe versions</span>
    <span class="tag-customer" v-click="1" style="left:55px;top:169px;font-size:18px;--twist:3deg">location menus</span>
    <span class="tag-ops" v-click="4" style="left:182px;top:165px;font-size:15px;--twist:-2deg">backup / restore drills</span>
    <span class="tag-customer" v-click="1" style="left:348px;top:165px;font-size:17px;--twist:-2deg">order history</span>
    <span class="tag-insight" v-click="3" style="left:462px;top:169px;font-size:17px;--twist:-3deg">low-stock alerts</span>
    <span class="tag-insight" v-click="3" style="left:597px;top:168px;font-size:17px;--twist:1deg">reorder planning</span>
    <span class="tag-staff" v-click="2" style="left:732px;top:166px;font-size:17px;--twist:1deg">paid expenses</span>
    <span class="tag-ops" v-click="4" style="left:33px;top:207px;font-size:18px;--twist:-1deg">Storybook</span>
    <span class="tag-staff" v-click="2" style="left:123px;top:209px;font-size:17px;--twist:-3deg">menu + options</span>
    <span class="tag-customer" v-click="1" style="left:243px;top:207px;font-size:18px;--twist:-4deg">receipts</span>
    <span class="tag-ops" v-click="4" style="left:325px;top:208px;font-size:16px;--twist:-1deg">Grafana dashboard</span>
    <span class="tag-ops" v-click="4" style="left:460px;top:211px;font-size:15px;--twist:4deg">server-owned pricing</span>
    <span class="tag-ops" v-click="4" style="left:607px;top:208px;font-size:18px;--twist:1deg">WCAG checks</span>
    <span class="tag-customer" v-click="1" style="left:711px;top:202px;font-size:18px;--twist:1deg">sugar + ice</span>
    <span class="tag-customer" v-click="1" style="left:44px;top:246px;font-size:18px;--twist:-4deg">order again</span>
    <span class="tag-insight" v-click="3" style="left:148px;top:245px;font-size:17px;--twist:2deg">idempotent orders</span>
    <span class="tag-ops" v-click="4" style="left:290px;top:242px;font-size:16px;--twist:-3deg">role + location scope</span>
    <span class="tag-staff" v-click="2" style="left:452px;top:249px;font-size:16px;--twist:-1deg">receipts + adjustments</span>
    <span class="tag-staff" v-click="2" style="left:621px;top:245px;font-size:16px;--twist:1deg">audit timeline</span>
    <span class="tag-ops" v-click="4" style="left:736px;top:240px;font-size:17px;--twist:0deg">Docker Compose</span>
    <span class="tag-customer" v-click="1" style="left:36px;top:278px;font-size:18px;--twist:1deg">two-shop picker</span>
    <span class="tag-insight" v-click="3" style="left:171px;top:281px;font-size:16px;--twist:4deg">no-oversell completion</span>
    <span class="tag-staff" v-click="2" style="left:340px;top:286px;font-size:19px;--twist:-4deg">cash collection</span>
    <span class="tag-staff" v-click="2" style="left:480px;top:281px;font-size:19px;--twist:0deg">stock balances</span>
    <span class="tag-customer" v-click="1" style="left:613px;top:285px;font-size:16px;--twist:4deg">customer accounts</span>
    <span class="tag-ops" v-click="4" style="left:748px;top:285px;font-size:16px;--twist:-3deg">health probes</span>
    <span class="tag-customer" v-click="1" style="left:22px;top:323px;font-size:19px;--twist:3deg">checkout recovery</span>
    <span class="tag-customer" v-click="1" style="left:179px;top:320px;font-size:17px;--twist:-3deg">cash pickup</span>
    <span class="tag-customer" v-click="1" style="left:278px;top:321px;font-size:18px;--twist:-4deg">SGD / MYR / CNY</span>
    <span class="tag-staff" v-click="2" style="left:413px;top:325px;font-size:18px;--twist:0deg">retry-safe stock</span>
    <span class="tag-staff" v-click="2" style="left:555px;top:321px;font-size:17px;--twist:-4deg">opening stock</span>
    <span class="tag-staff" v-click="2" style="left:668px;top:319px;font-size:18px;--twist:4deg">card reconciliation</span>
    <span class="tag-staff" v-click="2" style="left:99px;top:363px;font-size:17px;--twist:-1deg">shop creation</span>
    <span class="tag-ops" v-click="4" style="left:213px;top:361px;font-size:16px;--twist:1deg">Testcontainers</span>
    <span class="tag-ops" v-click="4" style="left:328px;top:361px;font-size:19px;--twist:-3deg">OpenTelemetry hooks</span>
    <span class="tag-customer" v-click="1" style="left:501px;top:357px;font-size:17px;--twist:1deg">custom drinks</span>
    <span class="tag-customer" v-click="1" style="left:615px;top:353px;font-size:15px;--twist:-4deg">5% favorite discount</span>
  </div>
</div>

<!--
This slide is intentionally overloaded and scattered, with no category headings. Four highlight colors connect customer, staff, intelligence, and engineering/operations features. Reveal the colors in four waves. Do not read every term: invite the audience to scan for the surprising ones. The supporting inventory in presentation/research.md maps the terms to implementation evidence. Stripe-hosted card checkout depends on merchant configuration. OpenTelemetry export is optional; the local Grafana/Prometheus dashboard is implemented. Runbooks exist, but do not imply that a production deployment is live.
-->

---
layout: none
---

<div class="slide technical-flow">
  <p class="eyebrow">03 / THE AGENT WORKFLOW</p>
  <h2>How a feature <span>moves.</span></h2>
  <div class="technical-chain">
    <div v-click="1"><b>01</b><strong>SPEC</strong><span>acceptance<br>+ invariants</span><small>spec-driven-development</small></div>
    <i v-click="2">→</i>
    <div v-click="2"><b>02</b><strong>FAILING TEST</strong><span>JUnit / Vitest<br>prove the rule</span><small>test-driven-development</small></div>
    <i v-click="3">→</i>
    <div v-click="3"><b>03</b><strong>IMPLEMENT</strong><span>database → API<br>→ typed UI</span><small>incremental-implementation</small></div>
    <i v-click="4">→</i>
    <div v-click="4"><b>04</b><strong>REVIEW</strong><span>diff + security<br>+ architecture</span><small>code-review-and-quality</small></div>
    <i v-click="5">→</i>
    <div v-click="5"><b>05</b><strong>CI</strong><span>tests + Compose<br>+ Playwright</span><small>GitHub Actions</small></div>
  </div>
  <p class="flow-footnote" v-click="5">Playwright runs in CI against the full stack, on desktop + mobile.</p>
</div>

<!--
Technical workflow: (1) A feature spec defines acceptance and invariants; spec-driven-development guides its structure. (2) Test-driven-development asks for a failing test before implementation, using JUnit/Testcontainers for Spring/PostgreSQL and Vitest for frontend behavior. (3) Incremental-implementation guides small changes across Flyway, Spring APIs, generated OpenAPI types, and React. (4) Code-review-and-quality checks correctness, architecture, security, and readability. (5) GitHub Actions runs backend and frontend verification, generated OpenAPI drift checks, boots the Compose stack, and runs desktop/mobile Playwright browser tests. Playwright is inside the CI release gate, not a separate step between implementation and CI. The skill files guide the agent; they do not execute the CI jobs.
-->

---
layout: none
---

<div class="slide technical-guardrails">
  <p class="eyebrow">04 / WHY THE LOOP HOLDS</p>
  <h2>What constrains <span>the agent?</span></h2>
  <div class="guardrail-map">
    <div v-click><b>AGENTS.md</b><span>module owners<br>Supabase → JWT<br>Spring checks roles<br>server price + stock</span></div>
    <div v-click><b>FLYWAY + PG</b><span>new V migration<br>immutable history<br>FKs + transactions<br>Hibernate validate</span></div>
    <div v-click><b>OPENAPI</b><span>Spring contract<br>generated TS types<br>drift fails CI</span></div>
    <div v-click><b>VERIFICATION</b><span>Testcontainers<br>Vitest<br>Playwright in CI</span></div>
  </div>
  <div class="observability-strip" v-click><b>OBSERVABILITY ↗</b><span>health checks</span><span>request IDs + JSON logs</span><span>Prometheus → Grafana</span><span>optional traces</span></div>
</div>

<!--
Tie each guardrail back to the workflow: AGENTS.md sets module ownership, server-owned prices and stock, and the rule against fake runtime business data. Local Supabase Auth identifies customers and staff; Spring resolves current roles and location assignments from PostgreSQL. The database uses new Flyway versioned migrations rather than edits to applied migrations, PostgreSQL foreign keys and transactions, and Hibernate `ddl-auto=validate` to catch mapping drift. OpenAPI catches backend/frontend contract drift. Testcontainers, Vitest, Playwright, and CI supply independent evidence. Once code runs, local health probes, correlated JSON logs, Prometheus metrics, and a provisioned Grafana dashboard show behavior. Trace export is optional; do not imply production monitoring or alerts are live. The skills guide an agent, while executable gates check its output.
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
