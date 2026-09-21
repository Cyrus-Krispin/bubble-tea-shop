import { beforeEach, expect, it } from "vitest";
import { CARD_ATTEMPT_KEY, readCardAttempt, saveCardAttempt } from "./cardAttemptStorage";
import type { CheckoutAttempt } from "./useCheckoutAttempt";
const attempt: CheckoutAttempt = { key: "10000000-0000-0000-0000-000000000001", slug: "shop", identity: null, uncertain: false, method: "CARD",
  input: { items: [{ variantId: "20000000-0000-0000-0000-000000000001", quantity: 1, optionChoiceIds: [] }] } };
beforeEach(() => sessionStorage.clear());
it("persists only retry identity and catalog input across a reload", () => {
  saveCardAttempt(attempt);
  expect(readCardAttempt()).toEqual({ ...attempt, uncertain: true });
  expect(Object.keys(JSON.parse(sessionStorage.getItem(CARD_ATTEMPT_KEY)!))).toEqual(["key", "input", "slug", "identity", "method"]);
});
it("rejects malformed recovery input without trusting storage as a price or identity source", () => {
  for (const value of [null, {}, { ...attempt, identity: "invalid" }, { ...attempt, input: { items: [{ variantId: "invalid", quantity: -1, optionChoiceIds: [] }] } }]) {
    sessionStorage.setItem(CARD_ATTEMPT_KEY, JSON.stringify(value)); expect(readCardAttempt()).toBeUndefined();
  }
});
