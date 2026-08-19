import { describe, expect, it } from "vitest";

import { demoDrinks } from "./demoCatalog";
import { calculatePreviewTotal, defaultConfiguration } from "./pricing";

describe("calculatePreviewTotal", () => {
  it("starts with the drink base price for default choices", () => {
    expect(calculatePreviewTotal(demoDrinks[0], defaultConfiguration)).toBe(660);
  });

  it("adds size and topping price deltas", () => {
    expect(calculatePreviewTotal(demoDrinks[0], {
      ...defaultConfiguration,
      size: "large",
      toppingIds: ["pearls", "aloe"],
    })).toBe(860);
  });

  it("does not mutate the base configuration", () => {
    calculatePreviewTotal(demoDrinks[0], {
      ...defaultConfiguration,
      toppingIds: ["pearls"],
    });

    expect(defaultConfiguration.toppingIds).toEqual([]);
  });
});
