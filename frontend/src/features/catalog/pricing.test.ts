import { describe, expect, it } from "vitest";

import { catalogProduct } from "../../test/catalogFixtures";
import { calculatePreviewTotal, createDefaultConfiguration } from "./pricing";

describe("calculatePreviewTotal", () => {
  it("selects database-marked defaults", () => {
    expect(createDefaultConfiguration(catalogProduct)).toEqual({
      variantId: "medium",
      variantName: "Medium",
      selections: [
        { groupId: "sweetness", groupName: "Sweetness", choiceIds: ["sweet-50"], choiceNames: ["50%"] },
        { groupId: "ice", groupName: "Ice", choiceIds: ["less-ice"], choiceNames: ["Less ice"] },
        { groupId: "toppings", groupName: "Toppings", choiceIds: [], choiceNames: [] },
      ],
    });
  });

  it("adds selected option deltas to the selected variant price", () => {
    const configuration = createDefaultConfiguration(catalogProduct);
    configuration.selections[2] = {
      ...configuration.selections[2],
      choiceIds: ["pearls", "aloe"],
      choiceNames: ["Pearls", "Aloe"],
    };

    expect(calculatePreviewTotal(catalogProduct, configuration)).toBe(780);
  });

  it("rejects stale selections that are not in the fetched product", () => {
    const configuration = createDefaultConfiguration(catalogProduct);
    configuration.selections[2] = {
      ...configuration.selections[2],
      choiceIds: ["not-an-option"],
      choiceNames: ["Unknown"],
    };

    expect(() => calculatePreviewTotal(catalogProduct, configuration)).toThrow("catalog selection is invalid");
  });
});
