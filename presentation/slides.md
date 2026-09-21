---
layout: none
theme: default
title: Bubble Tea Shop — the app and the workflow
info: A seven-slide project showcase mock
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
About 20 seconds. Introduce the app and tell the audience the rest of the talk is about how you built it with AI guardrails.
-->

---
layout: none
---

<div class="slide cloud">
  <p class="eyebrow">01 / THE PRODUCT</p>
  <h2>What it does <span class="scribble-underline">↘</span></h2>
  <div class="feature-cloud" aria-label="Bubble Tea Shop features">
    <span class="word cloud-word-1" v-click="1">CUSTOM DRINKS</span>
    <span class="word cloud-word-2" v-click="2">TWO SHOPS</span>
    <span class="word cloud-word-3" v-click="3">ORDERING</span>
    <span class="word cloud-word-4" v-click="4">RECIPES</span>
    <span class="word cloud-word-5" v-click="4">STOCK</span>
    <span class="word cloud-word-6" v-click="5">FAVORITES</span>
    <span class="word cloud-word-7" v-click="5">STAFF ORDERS</span>
    <span class="word cloud-word-8" v-click="6">CASH FLOW</span>
    <span class="word cloud-word-9" v-click="6">LOW-STOCK ALERTS</span>
    <span class="word cloud-word-10" v-click="7">HISTORY</span>
    <span class="word cloud-word-11" v-click="7">CARD CHECKOUT</span>
    <span class="word cloud-word-12" v-click="8">AUDIT TRAIL</span>
    <span class="word cloud-word-13" v-click="8">FORECASTS</span>
    <span class="word cloud-word-14" v-click="8">MANAGERS</span>
  </div>
</div>

<!--
About 45 seconds. Let the audience scan the screen. Do not read each word. Explain that the product covers the customer journey, staff operation, and stock tracking; then pivot to how the parts stay coherent.
-->

---
layout: none
---

<div class="slide architecture">
  <p class="eyebrow">02 / THE SHAPE</p>
  <h2>Three layers. <span>One app.</span></h2>
  <div class="arch-chain">
    <div class="sketch-node" v-click><span class="node-icon">▤</span><strong>React</strong><small>screens</small></div>
    <div class="sketch-arrow" v-click>⇢</div>
    <div class="sketch-node" v-click><span class="node-icon">⚙</span><strong>Spring</strong><small>rules</small></div>
    <div class="sketch-arrow" v-click>⇢</div>
    <div class="sketch-node" v-click><span class="node-icon">▦</span><strong>Postgres</strong><small>records</small></div>
  </div>
  <p class="footnote" v-click>Auth says who you are. Spring decides what you can do.</p>
</div>

<!--
About 35 seconds. React is customer and staff UI. Spring Boot is the only application backend and owns business workflows. PostgreSQL is the system of record. Local Supabase Auth issues identity, while Spring resolves permissions, prices, and stock from server-owned data.
-->

---
layout: none
---

<div class="slide process">
  <p class="eyebrow">03 / THE AGENT WORKFLOW</p>
  <h2>One feature. <span>One loop.</span></h2>
  <div class="loop">
    <div v-click><b>✎</b><strong>Plan</strong></div>
    <i v-click>→</i>
    <div v-click><b>×</b><strong>Red test</strong></div>
    <i v-click>→</i>
    <div v-click><b>✓</b><strong>Build</strong></div>
    <i v-click>→</i>
    <div v-click><b>◎</b><strong>Browser</strong></div>
    <i v-click>→</i>
    <div v-click><b>↗</b><strong>CI</strong></div>
  </div>
  <p class="footnote" v-click>Write the rule. Prove the rule. Then ship the slice.</p>
</div>

<!--
About 90 seconds. Talk through your pattern: a feature plan, a failing behavior test, a small implementation, the real browser journey, and CI. Specs and repository rules are context for the agent; test failures are feedback. Phrase this as the workflow you adopted, rather than claiming every historical feature followed it perfectly.
-->

---
layout: none
---

<div class="slide example">
  <p class="eyebrow">04 / A REAL EXAMPLE</p>
  <h2>One order. <span>No overselling.</span></h2>
  <div class="order-flow">
    <div class="flow-step" v-click><span class="flow-icon">◡</span><strong>Order</strong></div>
    <div class="flow-arrow" v-click>→</div>
    <div class="flow-step" v-click><span class="flow-icon">▤</span><strong>Check stock</strong></div>
    <div class="flow-arrow" v-click>→</div>
    <div class="flow-fork" v-click><span><b>✓</b> complete once</span><span><b>×</b> shortage: change nothing</span></div>
  </div>
  <p class="footnote" v-click>One transaction ties payment, order status, and inventory together.</p>
</div>

<!--
About two minutes. Explain that a server-priced order stores immutable consumption snapshots. Staff requests completion. Spring locks the order and relevant balances in one transaction; enough stock deducts once, while a shortage changes nothing. Integration tests cover retries and concurrent completions.
-->

---
layout: none
---

<div class="slide guardrails">
  <p class="eyebrow">05 / THE GUARDRAILS</p>
  <h2>Give AI <span>edges.</span></h2>
  <div class="guardrail-grid">
    <div v-click><span>⌗</span><strong>Boundaries</strong><small>who owns what</small></div>
    <div v-click><span>≡</span><strong>Contracts</strong><small>what must hold</small></div>
    <div v-click><span>✓</span><strong>Evidence</strong><small>what actually works</small></div>
  </div>
  <p class="footnote" v-click>AGENTS.md + feature specs + tests + CI</p>
</div>

<!--
About 75 seconds. Give concrete examples: identity, catalog, inventory, ordering are separate modules; server resolves authorization and prices; Flyway migrations and generated API types make change explicit; tests and CI challenge the implementation.
-->

---
layout: none
---

<div class="slide next">
  <p class="eyebrow">06 / STILL HUMAN WORK</p>
  <h2>AI is fast.<br><span>Judgment is mine.</span></h2>
  <div class="next-list">
    <div v-click><b>✦</b><strong>UI taste</strong><small>Does it feel clear?</small></div>
    <div v-click><b>◎</b><strong>Test quality</strong><small>Did we test the right thing?</small></div>
    <div v-click><b>✂</b><strong>Scope</strong><small>What should we leave out?</small></div>
  </div>
  <p class="closing" v-click>That's what I want to keep improving.</p>
</div>

<!--
About one minute. End honestly: AI makes it easy to create more code, but visual quality still requires taste, green tests can repeat a flawed assumption, and product scope needs deliberate cuts. Invite questions about the app or workflow.
-->
