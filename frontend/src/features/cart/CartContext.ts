import { createContext, useContext } from "react";

import type { CartDraft, CartItem, CartOrderLine } from "./cartReducer";

export type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  previewTotalMinor: number;
  locationSlug?: string;
  addItem: (draft: CartDraft) => void;
  addOrder: (lines: readonly CartOrderLine[]) => boolean;
  incrementItem: (itemId: string) => void;
  decrementItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}

export function useOptionalCartItemCount() {
  return useContext(CartContext)?.itemCount ?? 0;
}
