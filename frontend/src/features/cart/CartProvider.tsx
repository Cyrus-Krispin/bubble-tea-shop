import { useCallback, useReducer, type ReactNode } from "react";

import { useCheckoutAttempt } from "./useCheckoutAttempt";
import { CartContext, type CartContextValue } from "./CartContext";
import { cartReducer, initialCartState } from "./cartReducer";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const clearConfirmed = useCallback(() => dispatch({ type: "clear" }), []);
  const recovery = useCheckoutAttempt(clearConfirmed);
  const locked = recovery.state.attempt !== undefined;
  const value: CartContextValue = {
    checkoutState: recovery.state,
    checkout: (session, quote, method) => recovery.checkout(state.items, session, quote, method),
    finishCard: recovery.finishCard,
    items: state.items,
    itemCount: state.items.reduce((total, item) => total + item.quantity, 0),
    previewTotalMinor: state.items.reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0),
    locationSlug: state.items[0]?.locationSlug,
    addItem: (draft) => { if (!locked) { recovery.resetResult(); dispatch({ type: "add", draft }); } },
    addOrder: (lines) => {
      if (locked) return false;
      const current = { items: state.items };
      if (cartReducer(current, { type: "add-order", lines }) === current) return false;
      recovery.resetResult();
      dispatch({ type: "add-order", lines });
      return true;
    },
    incrementItem: (itemId: string) => !locked && dispatch({ type: "increment", itemId }),
    decrementItem: (itemId: string) => !locked && dispatch({ type: "decrement", itemId }),
    removeItem: (itemId: string) => !locked && dispatch({ type: "remove", itemId }),
    clearCart: () => !locked && dispatch({ type: "clear" }),
  };

  return (
    <CartContext value={value}>
      {children}
    </CartContext>
  );
}
