import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogLocations, catalogMenu } from "../../test/catalogFixtures";
import { expectNoAccessibilityViolations } from "../../test/accessibility";
import { CartProvider } from "../cart/CartProvider";
import { getGuestLocations, getGuestMenu } from "./catalogClient";
import { ShopPage } from "./ShopPage";

vi.mock("./catalogClient", () => ({
  getGuestLocations: vi.fn(),
  getGuestMenu: vi.fn(),
  getGuestProduct: vi.fn(),
}));

function renderShop() {
  return render(<MemoryRouter><CartProvider><ShopPage /></CartProvider></MemoryRouter>);
}

describe("ShopPage", () => {
  beforeEach(() => {
    vi.mocked(getGuestLocations).mockResolvedValue(catalogLocations);
    vi.mocked(getGuestMenu).mockResolvedValue(catalogMenu);
  });

  it("shows database-backed drinks with their starting prices", async () => {
    const { container } = renderShop();

    expect(await screen.findByRole("heading", { name: "Moonlit Milk Tea" })).toBeVisible();
    await expectNoAccessibilityViolations(container);
    expect(screen.getByRole("link", { name: /Customize Moonlit Milk Tea/ })).toHaveAttribute(
      "href",
      "/shop/orchard-central/drinks/moonlit-milk-tea",
    );
    expect(screen.getByRole("img", { name: "Moonlit Milk Tea in a clear cup" }))
      .toHaveAttribute("src", "/assets/catalog/moonlit-milk-tea.webp");
    fireEvent.click(screen.getByRole("button", { name: "Pickup at Orchard Central" }));
    expect(screen.getByRole("link", { name: /Tiong Bahru/ }).querySelector("img"))
      .toHaveAttribute("src", "/assets/catalog/tiong-bahru.webp");
    expect(screen.getAllByText("From $6.10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Orchard Central").length).toBeGreaterThan(0);
  });

  it("opens a compact location disclosure and closes it with Escape", async () => {
    renderShop();

    const trigger = await screen.findByRole("button", { name: "Pickup at Orchard Central" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /Tiong Bahru/ })).toHaveAttribute("href", "/shop/tiong-bahru");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
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
