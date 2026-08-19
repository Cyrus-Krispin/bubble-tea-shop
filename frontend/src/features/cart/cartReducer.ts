import type { DrinkConfiguration } from "../catalog/pricing";

export type CartDraft = {
  drinkId: string;
  drinkName: string;
  configuration: DrinkConfiguration;
  unitPriceMinor: number;
};

export type CartItem = CartDraft & {
  id: string;
  quantity: number;
};

export type CartState = { items: CartItem[] };

type CartAction =
  | { type: "add"; draft: CartDraft }
  | { type: "increment" | "decrement" | "remove"; itemId: string }
  | { type: "clear" };

export const initialCartState: CartState = { items: [] };

function cartItemId(draft: CartDraft) {
  const { size, sweetness, ice, toppingIds } = draft.configuration;
  return [draft.drinkId, size, sweetness, ice, ...[...toppingIds].sort()].join("|");
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === "clear") return initialCartState;

  if (action.type === "add") {
    const id = cartItemId(action.draft);
    const existingItem = state.items.find((item) => item.id === id);
    if (existingItem) {
      return {
        items: state.items.map((item) => item.id === id ? { ...item, quantity: item.quantity + 1 } : item),
      };
    }
    return { items: [...state.items, { ...action.draft, id, quantity: 1 }] };
  }

  if (action.type === "remove") {
    return { items: state.items.filter((item) => item.id !== action.itemId) };
  }

  return {
    items: state.items.flatMap((item) => {
      if (item.id !== action.itemId) return [item];
      const quantity = item.quantity + (action.type === "increment" ? 1 : -1);
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }),
  };
}
