import type { DrinkConfiguration } from "../catalog/pricing";

export type CartDraft = {
  locationSlug: string;
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

export type CartOrderLine = {
  draft: CartDraft;
  quantity: number;
};

export type CartState = { items: CartItem[] };

type CartAction =
  | { type: "add"; draft: CartDraft }
  | { type: "add-order"; lines: readonly CartOrderLine[] }
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
  return [draft.locationSlug, draft.drinkId, draft.configuration.variantId, ...choiceIds].join("|");
}

function addOrder(state: CartState, lines: readonly CartOrderLine[]): CartState {
  if (lines.length === 0) return state;
  const locationSlug = state.items[0]?.locationSlug ?? lines[0].draft.locationSlug;
  if (
    lines.some((line) => (
      line.quantity < 1 ||
      line.quantity > MAX_LINE_QUANTITY ||
      line.draft.locationSlug !== locationSlug
    )) ||
    itemCount(state) + lines.reduce((total, line) => total + line.quantity, 0) > MAX_ORDER_QUANTITY
  ) return state;

  const quantities = new Map(state.items.map((item) => [item.id, item.quantity]));
  const newItems = new Map<string, CartDraft>();
  for (const line of lines) {
    const id = cartItemId(line.draft);
    const quantity = (quantities.get(id) ?? 0) + line.quantity;
    if (quantity > MAX_LINE_QUANTITY) return state;
    quantities.set(id, quantity);
    if (!state.items.some((item) => item.id === id)) newItems.set(id, line.draft);
  }

  return {
    items: [
      ...state.items.map((item) => ({ ...item, quantity: quantities.get(item.id) ?? item.quantity })),
      ...Array.from(newItems, ([id, draft]) => ({ ...draft, id, quantity: quantities.get(id) ?? 1 })),
    ],
  };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === "clear") return initialCartState;

  if (action.type === "add") {
    return addOrder(state, [{ draft: action.draft, quantity: 1 }]);
  }

  if (action.type === "add-order") return addOrder(state, action.lines);

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
