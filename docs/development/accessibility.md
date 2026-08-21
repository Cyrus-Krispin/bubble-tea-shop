# Accessibility Verification

The frontend test suite runs `axe-core` against representative rendered states for shared dialogs,
customer registration, the guest menu and cart, inventory, staff orders, the audit timeline, and
owner manager management. The gate checks automatically detectable WCAG 2.0, 2.1, and 2.2 Level A
and AA violations and fails with the affected rule and selector.

Run the gate with the normal frontend suite:

```bash
cd frontend
pnpm test
```

The shared helper is `frontend/src/test/accessibility.ts`. New interactive surfaces should add an
assertion after their meaningful content or dialog becomes visible. This matters because axe does
not inspect hidden UI.

Automated checks do not establish complete WCAG conformance. The component tests use jsdom, which
has no layout engine, so color contrast is excluded there. Release review must still cover keyboard
operation and focus order, visible focus, zoom/reflow, screen-reader announcements, motion, and
contrast in a real browser. Existing semantic assertions and Compose-backed browser smoke tests
complement, but do not replace, that manual review.
