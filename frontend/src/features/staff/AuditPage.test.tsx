import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoAccessibilityViolations } from "../../test/accessibility";
import { selectOption } from "../../test/selectOption";
vi.mock("./auditClient", () => ({ listAuditEvents: vi.fn() }));

import AuditPage from "./AuditPage";
import { listAuditEvents } from "./auditClient";

const organizationId = "88b23060-cbc4-4218-9938-63d75f6f324c";
const outletContext = {
  accessToken: "staff-token",
  staffContext: {
    accountId: "account-id",
    memberships: [{
      organizationId,
      organizationName: "Bubble Tea Operations",
      role: "OWNER" as const,
      locations: [{
        id: "location-id",
        name: "Orchard Central",
        timezone: "Asia/Singapore",
        defaultLocale: "en-SG",
        currencyCode: "SGD",
      }],
    }],
  },
};

const events = [{
  id: "catalog-event",
  category: "CATALOG" as const,
  action: "UPDATED",
  entityType: "MENU_PRODUCT",
  entityId: "product-id",
  entityLabel: "Moonlit Milk Tea",
  locationId: null,
  locationName: null,
  actorAccountId: "account-id",
  actorLabel: "owner@example.com",
  occurredAt: "2026-08-22T00:00:00Z",
  detail: null,
}, {
  id: "order-event",
  category: "ORDER" as const,
  action: "COMPLETED",
  entityType: "ORDER",
  entityId: "order-id",
  entityLabel: "BT0000000001",
  locationId: "location-id",
  locationName: "Orchard Central",
  actorAccountId: null,
  actorLabel: null,
  occurredAt: "2026-08-22T00:05:00Z",
  detail: "PENDING → COMPLETED",
}];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/staff/audit"]}>
      <Routes>
        <Route element={<Outlet context={outletContext} />} path="/staff">
          <Route element={<AuditPage />} path="audit" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listAuditEvents).mockResolvedValue({
      items: events,
      page: 0,
      size: 50,
      totalItems: 2,
      totalPages: 1,
    });
  });

  it("renders organization-wide and guest operational activity", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("Moonlit Milk Tea")).toBeInTheDocument();
    await expectNoAccessibilityViolations(container);
    expect(screen.getByText("Organization-wide")).toBeInTheDocument();
    expect(screen.getByText("System / guest")).toBeInTheDocument();
    expect(screen.getByText("PENDING → COMPLETED")).toBeInTheDocument();
    expect(listAuditEvents).toHaveBeenCalledWith(
      "staff-token",
      organizationId,
      { category: undefined, page: 0, size: 50 },
      expect.any(AbortSignal),
    );
  });

  it("reloads from page one when the category changes and supports retry", async () => {
    renderPage();
    await screen.findByText("Moonlit Milk Tea");
    await selectOption(screen.getByLabelText("Category"), "Orders");

    await waitFor(() => expect(listAuditEvents).toHaveBeenLastCalledWith(
      "staff-token",
      organizationId,
      { category: "ORDER", page: 0, size: 50 },
      expect.any(AbortSignal),
    ));

    vi.mocked(listAuditEvents).mockRejectedValueOnce(new Error("network"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Audit history unavailable")).toBeInTheDocument();
    vi.mocked(listAuditEvents).mockResolvedValueOnce({
      items: [], page: 0, size: 50, totalItems: 0, totalPages: 0,
    });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No audit events match this category.")).toBeInTheDocument();
  });
});
