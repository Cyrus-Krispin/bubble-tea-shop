# Complete shadcn/ui Migration Checklist

Implementation follows `tasks/plan.md`. Each checkbox is complete only after its acceptance
criteria, focused verification, diff review, commit, and push are complete.

## Phase 1 — Foundation

- [x] Task 1: Configure Tailwind v4, shadcn, Radix, Lucide, aliases, and `components.json`.
- [x] Task 2: Create the application-wide dark ube/calamansi shadcn theme and add first primitives.
- [x] Add the Obsidian-inspired dark theme specimen and update the visual style guide.
- [x] Task 3: Replace shared primitives with tested shadcn-based application compositions.
- [x] Spawn two fresh-context senior agents for Obsidian fidelity and commerce/staff usability review.
- [x] Record and resolve or explicitly accept all Checkpoint A senior-review findings.
- [x] Checkpoint A: Approve application/Storybook theme and shared component behavior.

## Phase 2 — Customer journey

- [x] Task 4: Migrate customer shell, navigation, and route states.
- [x] Task 5: Migrate account access, auth forms, staff sign-in, and account landing.
- [x] Task 6: Migrate menu discovery and location selection with compact responsive product cards.
- [x] Show four complete cards per row at wide desktop and a complete first row above the fold.
- [x] Review real pale/dark drink and location photography on every dark surface and required width.
- [x] Task 7: Migrate drink customization and its responsive purchase action.
- [x] Task 8a: Migrate cart review, checkout, retry, and confirmation.
- [x] Task 8b: Migrate last-order quick add, history, and receipt detail.
- [x] Checkpoint B: Pass dark-theme desktop/mobile customer browser and accessibility review.

## Phase 3 — Staff workspace

- [x] Task 9: Migrate protected staff shell, navigation, and workspace overview.
- [x] Task 10a: Migrate ingredient management.
- [x] Task 10b: Migrate recipe management and immutable version detail.
- [x] Task 11a: Migrate menu product, variant, offering, price, and availability management.
- [x] Task 11b: Migrate option group, choice, default, and ingredient-effect management.
- [x] Task 12a: Migrate inventory balance, history, and movement workflows.
- [x] Task 12b: Migrate staff order queue, detail, cash completion, and shortages.
- [x] Task 13a: Migrate owner-only manager lifecycle and location assignments.
- [x] Task 13b: Migrate the operational audit timeline.
- [x] Repeat both fresh-context senior reviews across completed customer and staff routes.
- [x] Record and resolve or explicitly accept all Checkpoint C senior-review findings.
- [x] Checkpoint C: Pass dark-theme owner/manager desktop/mobile browser and accessibility review.

## Phase 4 — Removal and release gate

- [x] Task 14: Remove old primitives, CSS, selectors, and dependencies after zero-consumer proof.
- [x] Update visual-style, Storybook, accessibility, and maintenance documentation.
- [x] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm build-storybook`.
- [x] Run `pnpm e2e` against healthy Compose.
- [ ] Verify dark-theme contrast/no-light-flash, keyboard, focus return, VoiceOver, 200% zoom,
  reduced motion, forced colors, and all widths.
- [x] Run `git diff --check` and repository-wide legacy import/selector searches.
- [ ] Review, commit, push, and obtain human approval before merge.
