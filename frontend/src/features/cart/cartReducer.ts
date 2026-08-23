import type { DrinkConfiguration } from "../catalog/pricing";

export type CartDraft = {
  drinkId: string;
  drinkName: string;
  configuration: DrinkConfiguration;
  unitPriceMinor: number;
  currency: string;
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
export const MAX_LINE_QUANTITY = 20;
export const MAX_ORDER_QUANTITY = 50;

function itemCount(state: CartState) {
  return state.items.reduce((total, item) => total + item.quantity, 0);
}

function cartItemId(draft: CartDraft) {
  const choiceIds = draft.configuration.selections.flatMap((selection) => selection.choiceIds).sort();
  return [draft.drinkId, draft.configuration.variantId, ...choiceIds].join("|");
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === "clear") return initialCartState;

  if (action.type === "add") {
    if (itemCount(state) >= MAX_ORDER_QUANTITY) return state;
    const id = cartItemId(action.draft);
    const existingItem = state.items.find((item) => item.id === id);
    if (existingItem) {
      if (existingItem.quantity >= MAX_LINE_QUANTITY) return state;
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
      if (action.type === "increment" && (
        item.quantity >= MAX_LINE_QUANTITY || itemCount(state) >= MAX_ORDER_QUANTITY
      )) return [item];
      const quantity = item.quantity + (action.type === "increment" ? 1 : -1);
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }),
  };
}
