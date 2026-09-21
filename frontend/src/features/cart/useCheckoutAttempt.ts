import { CardPaymentError } from "./cardErrors";
import { readCardAttempt, saveCardAttempt, clearCardAttempt } from "./cardAttemptStorage";
import { useCallback, useRef, useState } from "react";
import type { OrderQuote } from "../auth/favoriteClient";
import type { AuthSession } from "../auth/types";
import type { CartItem } from "./cartReducer";
import { OrderError, placeGuestOrder, type CreateGuestOrderInput, type GuestOrder } from "./orderClient";

export type CheckoutAttempt = { key: string; input: CreateGuestOrderInput; slug: string; identity: string | null; uncertain: boolean; method?: "CASH" | "CARD"; cardId?: string; quote?: OrderQuote };
export type CheckoutState = { attempt?: CheckoutAttempt; busy: boolean; error?: string; result?: GuestOrder; resultSlug?: string; resultIdentity?: string | null };
export function useCheckoutAttempt(onConfirmed: () => void) {
  const [state, setState] = useState<CheckoutState>(() => ({ busy: false, attempt: readCardAttempt() }));
  const current = useRef(state);
  function update(next: CheckoutState) { current.current = next; setState(next); }
  async function checkout(items: readonly CartItem[], session: AuthSession | null, quote?: OrderQuote, method: "CASH" | "CARD" = "CASH") {
    if (current.current.busy || (items.length === 0 && !current.current.attempt)) return;
    const previous = current.current.attempt;
    const identity = session?.userId ?? null;
    if (previous?.identity && previous.identity !== identity) {
      update({ ...current.current, error: "Sign in to the original account to recover this order." }); return;
    }
    const attempt: CheckoutAttempt = previous ?? { key: crypto.randomUUID(), slug: items[0].locationSlug,
      identity, uncertain: false, method, quote, input: { items: items.map((item) => ({ variantId: item.configuration.variantId,
        quantity: item.quantity, optionChoiceIds: item.configuration.selections.flatMap((selection) => selection.choiceIds) })) } };
    if (attempt.method === "CARD") {
      try { saveCardAttempt(attempt); }
      catch {
        update({ busy: false, attempt: previous, error: "Allow this tab to save checkout recovery before paying by card." }); return;
      }
    }
    update({ attempt, busy: true });
    try {
      if (attempt.method === "CARD") {
        if (attempt.cardId) { update({ attempt, busy: false }); return; }
        const { createCardCheckout } = await import("./cardClient");
        const result = await createCardCheckout(attempt.slug, attempt.key, attempt.input, attempt.identity === null ? undefined : session?.accessToken);
        const identified = { ...attempt, cardId: result.id, uncertain: true };
        saveCardAttempt(identified); update({ attempt: identified, busy: false }); return;
      }
      const result = await placeGuestOrder(attempt.input, attempt.key, attempt.identity === null ? undefined : session?.accessToken, attempt.slug);
      update({ busy: false, result, resultSlug: attempt.slug, resultIdentity: attempt.identity });
      onConfirmed();
    } catch (error) {
      const definiteRejection = !attempt.uncertain && (error instanceof OrderError || error instanceof CardPaymentError) && error.status >= 400 && error.status < 500;
      if (definiteRejection) {
        if (attempt.method === "CARD") clearCardAttempt();
        update({ busy: false, error: error.code === "ORDER_CATALOG_CHANGED"
          ? "The menu changed while you were ordering. Review the current menu and update this order before trying again."
          : "The shop rejected this order. Review your order and account before trying again." });
      } else {
        update({ busy: false, attempt: { ...attempt, uncertain: true }, error: "We couldn’t confirm whether the order reached the shop. Retry this same order to check safely without creating a duplicate. Keep this page open; after a reload, check your history or ask the shop before ordering again." });
      }
    }
  }
  const finishCard = useCallback((id: string) => {
    if (current.current.attempt?.cardId !== id) return;
    clearCardAttempt(); current.current = { busy: false }; setState(current.current); onConfirmed();
  }, [onConfirmed]);
  return { state, checkout, finishCard, resetResult: () => { if (!current.current.attempt && !current.current.busy) update({ busy: false }); } };
}
