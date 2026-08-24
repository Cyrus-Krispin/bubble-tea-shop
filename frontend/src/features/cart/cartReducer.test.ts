import { describe, expect, it } from "vitest";

import {
  cartReducer,
  initialCartState,
  MAX_LINE_QUANTITY,
  MAX_ORDER_QUANTITY,
  type CartDraft,
} from "./cartReducer";

const moonlit: CartDraft = {
  locationSlug: "orchard-central",
  drinkId: "moonlit-milk-tea",
  drinkName: "Moonlit Milk Tea",
  configuration: {
    variantId: "medium",
    variantName: "Medium",
    selections: [
      { groupId: "toppings", groupName: "Toppings", choiceIds: ["pearls"], choiceNames: ["Pearls"] },
    ],
  },
  unitPriceMinor: 720,
  currency: "SGD",
};

describe("cartReducer", () => {
  it("adds a configured drink to the current order", () => {
    const state = cartReducer(initialCartState, { type: "add", draft: moonlit });

    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ drinkName: "Moonlit Milk Tea", quantity: 1 });
  });

  it("merges matching configurations and keeps different configurations separate", () => {
    const once = cartReducer(initialCartState, { type: "add", draft: moonlit });
    const twice = cartReducer(once, { type: "add", draft: moonlit });
    const withLarge = cartReducer(twice, {
      type: "add",
      draft: {
        ...moonlit,
        configuration: { ...moonlit.configuration, variantId: "large", variantName: "Large" },
        unitPriceMinor: 800,
      },
    });

    expect(withLarge.items).toHaveLength(2);
    expect(withLarge.items[0].quantity).toBe(2);
  });

  it("removes an item when its quantity is decreased from one", () => {
    const added = cartReducer(initialCartState, { type: "add", draft: moonlit });
    const state = cartReducer(added, { type: "decrement", itemId: added.items[0].id });

    expect(state.items).toEqual([]);
  });

  it("does not mix drinks from different pickup locations", () => {
    const orchard = cartReducer(initialCartState, { type: "add", draft: moonlit });
    const unchanged = cartReducer(orchard, {
      type: "add",
      draft: { ...moonlit, locationSlug: "tiong-bahru" },
    });

    expect(unchanged).toEqual(orchard);
  });

  it("caps line and order quantities at the checkout contract limits", () => {
    const lineAtLimit = { ...moonlit, id: "line", quantity: MAX_LINE_QUANTITY };
    expect(cartReducer({ items: [lineAtLimit] }, { type: "increment", itemId: "line" }))
      .toEqual({ items: [lineAtLimit] });

    const fullOrder = {
      items: [
        { ...moonlit, id: "one", quantity: MAX_LINE_QUANTITY },
        { ...moonlit, id: "two", quantity: MAX_LINE_QUANTITY },
        { ...moonlit, id: "three", quantity: MAX_ORDER_QUANTITY - (MAX_LINE_QUANTITY * 2) },
      ],
    };
    expect(cartReducer(fullOrder, { type: "increment", itemId: "three" })).toEqual(fullOrder);
    expect(cartReducer(fullOrder, { type: "add", draft: moonlit })).toEqual(fullOrder);
  });

  it("restores every line of a previous order atomically", () => {
    const restored = cartReducer(initialCartState, {
      type: "add-order",
      lines: [
        { draft: moonlit, quantity: 2 },
        {
          draft: {
            ...moonlit,
            drinkId: "mossy-matcha",
            drinkName: "Mossy Matcha",
            configuration: {
              ...moonlit.configuration,
              variantId: "large",
              variantName: "Large",
            },
          },
          quantity: 1,
        },
      ],
    });

    expect(restored.items).toHaveLength(2);
    expect(restored.items.map((item) => item.quantity)).toEqual([2, 1]);
  });

  it("leaves the cart unchanged when any restored line violates checkout limits", () => {
    const orchard = cartReducer(initialCartState, { type: "add", draft: moonlit });

    expect(cartReducer(orchard, {
      type: "add-order",
      lines: [{ draft: { ...moonlit, locationSlug: "tiong-bahru" }, quantity: 2 }],
    })).toEqual(orchard);
    expect(cartReducer(orchard, {
      type: "add-order",
      lines: [{ draft: moonlit, quantity: MAX_LINE_QUANTITY }],
    })).toEqual(orchard);
  });
});
