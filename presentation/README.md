# Bubble Tea Shop talk mock

This is a seven-slide, browser-based draft for a talk of about eight to ten minutes. It uses
Slidev so the scattered feature wall and technical workflow can animate on click. The visual
direction is hand-drawn diagrams rather than product photos. The title opens the talk, followed
by a silent 50-second product tour and the everyday order example. The tour includes customer
ordering, staff work, recipes, manager access, the connected-table diagram in Supabase Studio,
and Grafana. The workflow and
guardrails carry the technical detail.

[Research notes](research.md) record the implementation evidence behind the dense feature wall,
complexity numbers, authentication flow, and Codex skill references.

## Preview

```bash
cd presentation
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Slidev. Press Space or the right arrow to reveal each beat. Press
`f` for fullscreen; use presenter mode for speaker notes. The draft is sized for a 16:9 projector.
The video on slide 2 plays automatically while muted and has controls for pause or replay.

## Build for private hosting

```bash
pnpm build
```

Serve `dist/` as a static site. Keep access inside the tailnet. A local build on the presenting
laptop is a useful backup if the venue connection fails.

The text and timing are a starting point. The deck intentionally has no audience submission or QR
feature. The feature wall borrows the look, with presenter-controlled reveals.
