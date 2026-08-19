import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("../features/auth/authClient", () => ({
  signInWithEmailAndPassword: vi.fn(),
}));

import { App } from "./App";

describe("App", () => {
  it("lets a customer continue to the guest shop", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Continue as guest" }));

    expect(screen.getByRole("main")).toHaveAccessibleName("Guest shop");
    expect(screen.getByRole("heading", { level: 1, name: "Choose your brew" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Moonlit Milk Tea" })).toBeVisible();
  });

  it("keeps staff sign-in on its own route", () => {
    render(
      <MemoryRouter initialEntries={["/staff/sign-in"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("main")).toHaveAccessibleName("Staff sign in");
    expect(screen.getByRole("heading", { level: 1, name: "Sign in to your workspace" })).toBeVisible();
    expect(screen.getByText("Use your staff account to access shop operations.")).toBeVisible();
  });

  it("keeps a configured guest drink through to the current order", () => {
    render(
      <MemoryRouter initialEntries={["/shop/drinks/moonlit-milk-tea"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Pearls +$0.60" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to order · $7.20" }));
    fireEvent.click(screen.getByRole("link", { name: "View order" }));

    expect(screen.getByRole("heading", { level: 1, name: "Your current order" })).toBeVisible();
    expect(screen.getByText("Medium · 50% sweetness · Less ice · Pearls")).toBeVisible();
    expect(screen.getByText("Preview total").nextSibling).toHaveTextContent("$7.20");
  });
});
