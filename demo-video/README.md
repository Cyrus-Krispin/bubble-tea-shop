# Bubble Tea Shop product demo video

This silent talk insert is rendered from real browser screenshots of the local Docker stack. It
shows shop selection, drink customization, checkout, the staff queue, published recipe formulas,
inventory forecasts, owner-managed shop access, Supabase Studio's connected-table diagram, and the
Grafana dashboard. The edit adds a floating browser frame and an animated cursor that moves
to the same controls Playwright actually used. It is designed to play after the talk's cover slide.

## Rebuild from main

Use a macOS checkout of main with `ffmpeg` installed. Configure local Auth as described in
[local Docker setup](../docs/development/local-docker.md). From the repository root:

```bash
docker compose up -d --build --wait
cd frontend && pnpm install --frozen-lockfile && cd ..
python3 -m venv demo-video/.venv
demo-video/.venv/bin/pip install -r demo-video/requirements.txt
```

Set `DEMO_STAFF_EMAIL` and `DEMO_STAFF_PASSWORD` to the local bootstrap account, then run:

```bash
node demo-video/capture.mjs
demo-video/.venv/bin/python demo-video/render.py
```

The final file is `demo-video/output/bubble-tea-shop-demo.mp4`. Screenshots, the scene manifest,
the virtual environment, and the rendered MP4 stay local and are ignored by Git. The video has no
music or narration so the presenter can speak over it. The local test order remains in the local
Docker database. The screenshots are real captured app states; the floating frame and cursor movement
are added during rendering. The browser frame stays fixed while the camera moves gently into
selected product details. The Large and pearls actions each have a captured before and after state,
so the selected control and resulting price change are visible. State changes use clean cuts.
The Schema Visualizer scene pans through the real diagram to show how the database tables connect.
The capture uses local Supabase Studio at `http://localhost:54323` by default; set
`DEMO_STUDIO_URL` if your local port differs.

To publish a new cut in the talk, copy the rendered MP4 and a poster frame into
`presentation/public/`, then update the video paths in `presentation/slides.md` and the media
check in `.github/workflows/ci.yml`. Use a new filename so a browser cannot reuse an older cut.
