import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { catalogProduct } from "../../test/catalogFixtures";
import { CounterDrink } from "./CounterDrink";

it("clears an optional single choice from counter pricing and submitted IDs", () => {
  const product = { ...catalogProduct, variants: catalogProduct.variants.map((variant) => ({ ...variant,
    optionGroups: variant.optionGroups.map((group) => group.name === "Toppings" ? { ...group, maximumSelections: 1 } : group),
  })) };
  const add = vi.fn(); render(<CounterDrink product={product} onAdd={add} disabled={false} />);
  expect(screen.getByRole("radio", { name: "None for Toppings" })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: "Pearls +$0.60" }));
  expect(screen.getByRole("button", { name: "Add drink · $7.20" })).toBeEnabled();
  fireEvent.click(screen.getByRole("radio", { name: "None for Toppings" }));
  fireEvent.click(screen.getByRole("button", { name: "Add drink · $6.60" }));
  expect(add).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: 660, optionChoiceIds: ["sweet-50", "less-ice"] }));
  expect(screen.queryByRole("radio", { name: "None for Sweetness" })).not.toBeInTheDocument();
});
