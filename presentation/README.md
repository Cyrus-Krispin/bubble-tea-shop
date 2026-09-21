# Bubble Tea Shop talk mock

This is a seven-slide, browser-based draft for a talk of about seven to nine minutes. It uses
Slidev so the feature cloud and workflow can animate on click. The visual direction is a sparse,
hand-drawn diagram rather than product photos. The demo video is intentionally left out of this
version; it can be added later if it strengthens the talk.

## Preview

```bash
cd presentation
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Slidev. Press Space or the right arrow to reveal each beat. Press
`f` for fullscreen; use presenter mode for speaker notes. The draft is sized for a 16:9 projector.

## Build for private hosting

```bash
pnpm build
```

Serve `dist/` as a static site. Keep access inside the tailnet. A local build on the presenting
laptop is a useful backup if the venue connection fails.

The text and timing are a starting point. The deck intentionally has no audience submission or QR
feature. Its word cloud borrows the look, with presenter-controlled reveals.
