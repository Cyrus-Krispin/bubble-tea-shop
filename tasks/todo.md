# Complete shadcn/ui Migration Checklist

Implementation follows `tasks/plan.md`. Each checkbox is complete only after its acceptance
criteria, focused verification, diff review, commit, and push are complete.

## Phase 1 — Foundation

- [ ] Task 1: Configure Tailwind v4, shadcn, Radix, Lucide, aliases, and `components.json`.
- [ ] Task 2: Map the approved brand system to shadcn semantic tokens and add first primitives.
- [ ] Task 3: Replace shared primitives with tested shadcn-based application compositions.
- [ ] Checkpoint A: Approve application/Storybook theme and shared component behavior.

## Phase 2 — Customer journey

- [ ] Task 4: Migrate customer shell, navigation, and route states.
- [ ] Task 5: Migrate account access, auth forms, staff sign-in, and account landing.
- [ ] Task 6: Migrate menu discovery, product cards, photography, and location selection.
- [ ] Task 7: Migrate drink customization and its responsive purchase action.
- [ ] Task 8a: Migrate cart review, checkout, retry, and confirmation.
- [ ] Task 8b: Migrate last-order quick add, history, and receipt detail.
- [ ] Checkpoint B: Pass desktop/mobile customer browser and accessibility review.

## Phase 3 — Staff workspace

- [ ] Task 9: Migrate protected staff shell, navigation, and workspace overview.
- [ ] Task 10a: Migrate ingredient management.
- [ ] Task 10b: Migrate recipe management and immutable version detail.
- [ ] Task 11a: Migrate menu product, variant, offering, price, and availability management.
- [ ] Task 11b: Migrate option group, choice, default, and ingredient-effect management.
- [ ] Task 12a: Migrate inventory balance, history, and movement workflows.
- [ ] Task 12b: Migrate staff order queue, detail, cash completion, and shortages.
- [ ] Task 13a: Migrate owner-only manager lifecycle and location assignments.
- [ ] Task 13b: Migrate the operational audit timeline.
- [ ] Checkpoint C: Pass owner/manager desktop/mobile browser and accessibility review.

## Phase 4 — Removal and release gate

- [ ] Task 14: Remove old primitives, CSS, selectors, and dependencies after zero-consumer proof.
- [ ] Update visual-style, Storybook, accessibility, and maintenance documentation.
- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm build-storybook`.
- [ ] Run `pnpm e2e` against healthy Compose.
- [ ] Verify keyboard, focus return, VoiceOver, 200% zoom, reduced motion, forced colors, and all widths.
- [ ] Run `git diff --check` and repository-wide legacy import/selector searches.
- [ ] Review, commit, push, and obtain human approval before merge.
