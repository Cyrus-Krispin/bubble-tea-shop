# Storybook

Storybook documents the reusable React interface primitives in isolation. It includes controls,
generated component documentation, and the official accessibility panel. Stories are written in
Component Story Format and live beside the component they describe.

Run the interactive catalog:

```bash
cd frontend
pnpm storybook
```

Build the static catalog exactly as CI does:

```bash
cd frontend
pnpm build-storybook
```

The generated `frontend/storybook-static/` directory is ignored because it is a build artifact.
CI rebuilds it from the committed stories. The project-level accessibility parameter treats
violations as errors when Storybook tests are run, while the regular Vitest suite remains the
mandatory automated WCAG gate.

New reusable components should include stories for materially different visual or interaction
states. Prefer args for component inputs, keep test data fictional and local to stories, and never
connect stories to live customer or operational APIs.
