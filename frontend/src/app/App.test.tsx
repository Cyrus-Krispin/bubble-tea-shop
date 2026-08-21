import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogMenu, catalogProduct } from "../test/catalogFixtures";

vi.mock("../features/auth/authClient", () => ({
  getCurrentAuthSession: vi.fn().mockResolvedValue(null),
  signInCustomer: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  signUpCustomer: vi.fn(),
  subscribeToAuthState: vi.fn().mockReturnValue(() => undefined),
}));
vi.mock("../features/catalog/catalogClient", () => ({
  getGuestMenu: vi.fn(),
  getGuestProduct: vi.fn(),
}));
vi.mock("../features/staff/staffClient", () => ({
  getStaffContext: vi.fn(),
  StaffContextError: class StaffContextError extends Error {
    constructor(public code: string, public status: number) {
      super(code);
    }
  },
}));

import { App } from "./App";
import { getCurrentAuthSession } from "../features/auth/authClient";
import { getGuestMenu, getGuestProduct } from "../features/catalog/catalogClient";
import { getStaffContext, StaffContextError } from "../features/staff/staffClient";

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentAuthSession).mockResolvedValue(null);
    vi.mocked(getGuestMenu).mockResolvedValue(catalogMenu);
    vi.mocked(getGuestProduct).mockResolvedValue(catalogProduct);
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [],
    });
  });

  it("offers optional customer account creation without blocking guest ordering", () => {
    render(
      <MemoryRouter initialEntries={["/account/create"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("main")).toHaveAccessibleName("Create customer account");
    expect(screen.getByRole("heading", { level: 1, name: "Save your tea journey" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Continue as guest" })).toHaveAttribute("href", "/shop");
  });

  it("shows the signed-in customer account without granting a staff role", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "customer-token",
      email: "customer@example.test",
    });

    render(
      <MemoryRouter initialEntries={["/account"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("customer@example.test")).toBeVisible();
    expect(screen.getByText("Customer account")).toBeVisible();
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
    expect(screen.queryByText("Manager")).not.toBeInTheDocument();
  });

  it("does not offer registration to an already signed-in account", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "customer-token",
      email: "customer@example.test",
    });

    render(
      <MemoryRouter initialEntries={["/account/create"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("customer@example.test")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Create account" })).not.toBeInTheDocument();
  });

  it("lets a customer continue to the guest shop", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Continue as guest" }));

    expect(await screen.findByRole("main", { name: "Guest shop" })).toBeVisible();
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

  it("guards the staff workspace and renders only server-returned scope", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "staff-token",
      email: "owner@example.test",
    });
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [{
        organizationId: "88b23060-cbc4-4218-9938-63d75f6f324c",
        organizationName: "Bubble Tea Operations",
        role: "OWNER",
        locations: [{
          id: "42eeb769-306a-4b1a-97cc-350e2e9ea90b",
          name: "Orchard Central",
          timezone: "Asia/Singapore",
          defaultLocale: "en-SG",
          currencyCode: "SGD",
        }],
      }],
    });

    render(
      <MemoryRouter initialEntries={["/staff"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Operations overview" })).toBeVisible();
    expect(screen.getByRole("main", { name: "Staff workspace" })).toBeVisible();
    expect(await screen.findByText("Bubble Tea Operations")).toBeVisible();
    expect(screen.getByText("Owner")).toBeVisible();
    expect(screen.getByText("Orchard Central")).toBeVisible();
    expect(getStaffContext).toHaveBeenCalledWith("staff-token", expect.any(AbortSignal));
  });

  it("redirects signed-out visitors from the staff workspace to staff sign in", async () => {
    render(
      <MemoryRouter initialEntries={["/staff"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("main", { name: "Staff sign in" })).toBeVisible();
    expect(getStaffContext).not.toHaveBeenCalled();
  });

  it("shows a generic no-access state without inventing an organization", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "customer-token",
      email: "customer@example.test",
    });
    vi.mocked(getStaffContext).mockRejectedValue(
      new StaffContextError("STAFF_ACCESS_DENIED", 403),
    );

    render(
      <MemoryRouter initialEntries={["/staff"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "No active staff access" })).toBeVisible();
    expect(screen.getByText(/does not have an active staff membership/i)).toBeVisible();
    expect(screen.queryByText("Bubble Tea Operations")).not.toBeInTheDocument();
  });

  it("keeps a configured guest drink through to the current order", async () => {
    render(
      <MemoryRouter initialEntries={["/shop/drinks/moonlit-milk-tea"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Moonlit Milk Tea" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Pearls +$0.60" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to order · $7.20" }));
    fireEvent.click(screen.getByRole("link", { name: "View order" }));

    expect(screen.getByRole("heading", { level: 1, name: "Your current order" })).toBeVisible();
    expect(screen.getByText("Medium · 50% · Less ice · Pearls")).toBeVisible();
    expect(screen.getByText("Preview total").nextSibling).toHaveTextContent("$7.20");
  });
});
