import { useMemo, useReducer, type ReactNode } from "react";

import { CartContext, type CartContextValue } from "./CartContext";
import { cartReducer, initialCartState } from "./cartReducer";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const value = useMemo<CartContextValue>(() => ({
    items: state.items,
    itemCount: state.items.reduce((total, item) => total + item.quantity, 0),
    previewTotalMinor: state.items.reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0),
    addItem: (draft) => dispatch({ type: "add", draft }),
    incrementItem: (itemId: string) => dispatch({ type: "increment", itemId }),
    decrementItem: (itemId: string) => dispatch({ type: "decrement", itemId }),
    removeItem: (itemId: string) => dispatch({ type: "remove", itemId }),
  }), [state.items]);

  return (
    <CartContext value={value}>
      {children}
    </CartContext>
  );
}
