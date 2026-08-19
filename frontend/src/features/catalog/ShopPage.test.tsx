import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { CartProvider } from "../cart/CartProvider";
import { ShopPage } from "./ShopPage";

function renderShop() {
  render(<MemoryRouter><CartProvider><ShopPage /></CartProvider></MemoryRouter>);
}

describe("ShopPage", () => {
  it("shows available drinks with their starting prices", () => {
    renderShop();

    expect(screen.getByRole("heading", { name: "Moonlit Milk Tea" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Customize Moonlit Milk Tea/ })).toHaveAttribute(
      "href",
      "/shop/drinks/moonlit-milk-tea",
    );
    expect(screen.getAllByText("From $6.60").length).toBeGreaterThan(0);
  });

  it("filters the menu by category", () => {
    renderShop();

    fireEvent.click(screen.getByRole("button", { name: "Fruit tea" }));

    expect(screen.getByRole("heading", { name: "Sunberry Oolong" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Moonlit Milk Tea" })).not.toBeInTheDocument();
  });

  it("marks sold-out drinks without offering customization", () => {
    renderShop();

    expect(screen.getByText("Sold out", { selector: ".product-status" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Customize Cloudberry Taro/ })).not.toBeInTheDocument();
  });
});
