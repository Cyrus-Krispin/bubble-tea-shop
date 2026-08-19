import { describe, expect, it } from "vitest";

import { cartReducer, initialCartState, type CartDraft } from "./cartReducer";

const moonlit: CartDraft = {
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
});
