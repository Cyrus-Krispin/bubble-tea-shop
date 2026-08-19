import { createContext, useContext } from "react";

import type { CartDraft, CartItem } from "./cartReducer";

export type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  previewTotalMinor: number;
  addItem: (draft: CartDraft) => void;
  incrementItem: (itemId: string) => void;
  decrementItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
