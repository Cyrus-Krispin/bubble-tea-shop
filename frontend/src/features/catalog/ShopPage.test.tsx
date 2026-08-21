import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogMenu } from "../../test/catalogFixtures";
import { expectNoAccessibilityViolations } from "../../test/accessibility";
import { CartProvider } from "../cart/CartProvider";
import { getGuestMenu } from "./catalogClient";
import { ShopPage } from "./ShopPage";

vi.mock("./catalogClient", () => ({
  getGuestMenu: vi.fn(),
  getGuestProduct: vi.fn(),
}));

function renderShop() {
  return render(<MemoryRouter><CartProvider><ShopPage /></CartProvider></MemoryRouter>);
}

describe("ShopPage", () => {
  beforeEach(() => vi.mocked(getGuestMenu).mockResolvedValue(catalogMenu));

  it("shows database-backed drinks with their starting prices", async () => {
    const { container } = renderShop();

    expect(await screen.findByRole("heading", { name: "Moonlit Milk Tea" })).toBeVisible();
    await expectNoAccessibilityViolations(container);
    expect(screen.getByRole("link", { name: /Customize Moonlit Milk Tea/ })).toHaveAttribute(
      "href",
      "/shop/drinks/moonlit-milk-tea",
    );
    expect(screen.getAllByText("From $6.10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Orchard Central").length).toBeGreaterThan(0);
  });

  it("filters the menu by categories returned by the API", async () => {
    renderShop();

    await screen.findByRole("heading", { name: "Moonlit Milk Tea" });
    fireEvent.click(screen.getByRole("button", { name: "Fruit tea" }));

    expect(screen.getByRole("heading", { name: "Sunberry Oolong" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Moonlit Milk Tea" })).not.toBeInTheDocument();
  });

  it("marks sold-out drinks without offering customization", async () => {
    renderShop();

    await screen.findByRole("heading", { name: "Cloudberry Taro" });
    expect(screen.getByText("Sold out", { selector: ".product-status" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Customize Cloudberry Taro/ })).not.toBeInTheDocument();
  });

  it("shows a recoverable error instead of fallback products", async () => {
    vi.mocked(getGuestMenu).mockRejectedValueOnce(new Error("offline"));
    renderShop();

    expect(await screen.findByText("We couldn’t load the menu.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Moonlit Milk Tea" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
