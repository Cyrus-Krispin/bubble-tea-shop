# Collected payments and paid expenses

Managers can inspect money collected, paid expenses, and the difference for 1, 7, or 30 local
calendar days including today at an assigned shop. This is an operational cash-flow view, not
profit or a bank reconciliation report. Missing expense records make outflow incomplete.

## Rules

- Ordering owns payment reporting and the operational expense ledger. Current server-side staff
  access is required for every read and write; client organization/location IDs never grant access.
- Count only PAID payments by paid_at, never pending order totals or stock receipt estimates.
  Report each recorded currency separately, including historical currencies; never perform FX.
- Windows begin at local midnight days-1 days ago and end at the report's database timestamp.
  Return zero-filled daily values so quiet days remain visible.
- Record expenses when paid through a form containing description and positive amount in the
  location currency. The server timestamps and attributes the entry. Historical imports are outside
  this increment. Maximum amount is 1,000,000 currency units per entry.
- Repeated submissions with the same location/key and identical actor/amount/description return
  one expense. Changed payloads or actors conflict. An uncertain response retains the same key.
- Mistaken entries can be voided with a reason. Immutable expense and void records preserve the
  actor and timestamps; voiding is idempotent and corrects the original report period. It does not
  represent a cash refund or alter stock. No destructive expense deletion or edit is exposed.
- Show recent expense entries with pagination and void status, plus loading/error/empty states.

## Verification

Test current scope, invalid amounts, key replay/conflicts, immutable storage, expense voiding,
paid/pending exclusions, currency separation, timezone boundaries, zero days, and 1/7/30 filters.
Run the backend and frontend suites and verify a manager recording and voiding an expense in
real desktop/mobile browsers. Add Flyway V16 and update ERD, dictionary, invariants, API, and scope.
