# Safe retries for manual stock movements

A lost response after a committed receipt or adjustment must not apply stock twice. The manual
inventory UI is the authorized restocking workflow; no supplier integration is required.

## Contract

- Every manual movement POST requires an unpredictable UUID Idempotency-Key. Bind each key to the
  resolved staff account, shop and normalized input. Same-key retries return the original movement;
  changing input or actor conflicts. Authorize every retry before returning historical data.
- The request identity, ledger entry and balance change commit atomically. Concurrent same-key
  requests produce one movement. Failed validations or insufficient stock commit nothing.
- Previously committed retries continue to work after an ingredient is archived. New movements
  still require an active ingredient. No existing audit rows are rewritten.
- Keep the original UI input/key through ambiguous failures, dialog dismissal, navigation and
  token refresh in the same signed-in app session. Prevent edits while the outcome is unknown.
  Retry with the same key, including after a later 4xx response; release only an initially definite
  rejection or confirmed success. A new request must not replace an unresolved one.
- State is memory-only and cleared on sign-out/account change. Explain that after a full reload,
  staff must reconcile movement history before entering the delivery again.

## Verification

API tests: same-key sequential/concurrent replay, actor/payload mismatch, archived replay, failed
transaction retry, one ledger entry and one balance delta. UI tests: unknown outcome, same key/input
on retry after rerender/navigation, disabled edits, single flight, definite rejection. Browser check:
commit a receipt, drop its response, recover, verify exactly one movement. Run full backend/frontend
checks and independent review.
