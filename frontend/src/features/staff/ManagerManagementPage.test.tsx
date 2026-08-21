import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./managerClient", () => ({
  listManagers: vi.fn(),
  addOrReactivateManager: vi.fn(),
  replaceManagerAssignments: vi.fn(),
  deactivateManager: vi.fn(),
  ManagerError: class ManagerError extends Error {
    constructor(public code: string, public status: number) { super(code); }
  },
}));

import ManagerManagementPage from "./ManagerManagementPage";
import type { StaffOutletContext } from "./StaffLayout";
import {
  addOrReactivateManager,
  deactivateManager,
  listManagers,
  replaceManagerAssignments,
} from "./managerClient";

const organizationId = "organization-id";
const north = { id: "north-id", name: "North", timezone: "Asia/Singapore", defaultLocale: "en-SG", currencyCode: "SGD" };
const south = { id: "south-id", name: "South", timezone: "Asia/Singapore", defaultLocale: "en-SG", currencyCode: "SGD" };
const manager = {
  id: "membership-id",
  accountId: "account-id",
  email: "manager@example.test",
  active: true,
  version: 0,
  locations: [{ id: north.id, name: north.name }],
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
};
const ownerContext: StaffOutletContext = {
  accessToken: "owner-token",
  staffContext: {
    accountId: "owner-id",
    memberships: [{
      organizationId,
      organizationName: "Bubble Tea Operations",
      role: "OWNER" as const,
      locations: [north, south],
    }],
  },
};

function renderPage(context = ownerContext) {
  return render(
    <MemoryRouter initialEntries={["/staff/managers"]}>
      <Routes>
        <Route element={<Outlet context={context} />} path="/staff">
          <Route element={<ManagerManagementPage />} path="managers" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ManagerManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listManagers).mockResolvedValue({
      items: [manager], page: 0, size: 25, totalItems: 1, totalPages: 1,
    });
    vi.mocked(addOrReactivateManager).mockResolvedValue(manager);
    vi.mocked(replaceManagerAssignments).mockResolvedValue({
      ...manager, version: 1, locations: [{ id: south.id, name: south.name }],
    });
    vi.mocked(deactivateManager).mockResolvedValue({ ...manager, active: false, version: 1 });
  });

  it("loads owner-scoped managers and grants access to a registered email", async () => {
    renderPage();
    expect(await screen.findByText("manager@example.test")).toBeInTheDocument();
    expect(listManagers).toHaveBeenCalledWith(
      "owner-token", organizationId, { page: 0, size: 25 }, expect.any(AbortSignal),
    );

    fireEvent.change(screen.getByLabelText("Registered email"), { target: { value: "new@example.test" } });
    fireEvent.click(screen.getByLabelText("South"));
    fireEvent.click(screen.getByRole("button", { name: "Grant manager access" }));
    await waitFor(() => expect(addOrReactivateManager).toHaveBeenCalledWith(
      "owner-token", organizationId, { email: "new@example.test", locationIds: [south.id] },
    ));
  });

  it("replaces assignments and confirms deactivation", async () => {
    renderPage();
    await screen.findByText("manager@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Edit access" }));
    let dialog = screen.getByRole("dialog", { name: "Edit manager access" });
    fireEvent.click(within(dialog).getByLabelText("North"));
    fireEvent.click(within(dialog).getByLabelText("South"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save access" }));
    await waitFor(() => expect(replaceManagerAssignments).toHaveBeenCalledWith(
      "owner-token", organizationId, manager.id, 0, [south.id],
    ));

    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    dialog = screen.getByRole("dialog", { name: "Deactivate manager?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm deactivation" }));
    await waitFor(() => expect(deactivateManager).toHaveBeenCalledWith(
      "owner-token", organizationId, manager.id, 0,
    ));
  });

  it("fails closed for a manager without an owner membership", () => {
    renderPage({
      ...ownerContext,
      staffContext: {
        ...ownerContext.staffContext,
        memberships: [{ ...ownerContext.staffContext.memberships[0], role: "MANAGER" as const }],
      },
    });
    expect(screen.getByText("Owner access required")).toBeInTheDocument();
    expect(listManagers).not.toHaveBeenCalled();
  });
});
