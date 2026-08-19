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
});
