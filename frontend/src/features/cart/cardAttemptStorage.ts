import type { CheckoutAttempt } from "./useCheckoutAttempt";
export const CARD_ATTEMPT_KEY = "bubble-tea:card-attempt:v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readCardAttempt(): CheckoutAttempt | undefined {
  try {
    const raw = sessionStorage.getItem(CARD_ATTEMPT_KEY);
    if (!raw || raw.length > 30_000) return;
    const value = JSON.parse(raw) as CheckoutAttempt;
    if (value.method !== "CARD" || !uuid.test(value.key) || typeof value.slug !== "string" || value.slug.length > 160
      || (value.identity !== null && (typeof value.identity !== "string" || !uuid.test(value.identity)))
      || (value.cardId !== undefined && !uuid.test(value.cardId)) || !Array.isArray(value.input?.items)
      || value.input.items.length < 1 || value.input.items.length > 25) return;
    for (const line of value.input.items) if (!uuid.test(line.variantId) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20
      || !Array.isArray(line.optionChoiceIds) || line.optionChoiceIds.length > 30 || line.optionChoiceIds.some((id: unknown) => typeof id !== "string" || !uuid.test(id))) return;
    return { key: value.key, slug: value.slug, identity: value.identity, method: "CARD", cardId: value.cardId,
      input: value.input, uncertain: true };
  } catch { return; }
}
export function saveCardAttempt(attempt: CheckoutAttempt) {
  // No credentials or card data. Persist before posting so a hosted redirect/reload keeps the same purchase identity.
  sessionStorage.setItem(CARD_ATTEMPT_KEY, JSON.stringify({ key: attempt.key, input: attempt.input,
    slug: attempt.slug, identity: attempt.identity, method: "CARD", cardId: attempt.cardId }));
}
export function clearCardAttempt() { try { sessionStorage.removeItem(CARD_ATTEMPT_KEY); } catch { /* A stale identity safely replays the same order after reload. */ } }
