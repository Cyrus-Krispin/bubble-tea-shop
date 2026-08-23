import { afterEach, describe, expect, it, vi } from "vitest";

import { listAuditEvents } from "./auditClient";

const auditEvent = {
  id: "event-id",
  category: "ORDER",
  action: "COMPLETED",
  entityType: "ORDER",
  entityId: "order-id",
  entityLabel: "BT0000000001",
  locationId: "location-id",
  locationName: "Orchard Central",
  actorAccountId: "account-id",
  actorLabel: "owner@example.com",
  occurredAt: "2026-08-22T00:05:00Z",
  detail: "PENDING → COMPLETED",
};

afterEach(() => vi.unstubAllGlobals());

describe("auditClient", () => {
  it("loads a scoped filtered timeline with bearer authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [auditEvent],
      page: 0,
      size: 50,
      totalItems: 1,
      totalPages: 1,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAuditEvents("token", "org", {
      category: "ORDER",
      page: 0,
      size: 50,
    })).resolves.toMatchObject({ items: [auditEvent] });

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.headers.get("authorization")).toBe("Bearer token");
    const url = new URL(request.url);
    expect(url.pathname).toBe("/api/v1/staff/organizations/org/audit-events");
    expect(url.searchParams.get("category")).toBe("ORDER");
    expect(url.searchParams.get("size")).toBe("50");
  });

  it("accepts null system fields and rejects malformed success responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{
        ...auditEvent,
        category: "CATALOG",
        locationId: null,
        locationName: null,
        actorAccountId: null,
        actorLabel: null,
        detail: null,
      }],
      page: 0,
      size: 50,
      totalItems: 1,
      totalPages: 1,
    }), { status: 200 })));
    await expect(listAuditEvents("token", "org", { page: 0, size: 50 }))
      .resolves.toMatchObject({ items: [{ locationName: null, actorLabel: null }] });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ ...auditEvent, category: "UNKNOWN" }],
      page: 0,
      size: 50,
      totalItems: 1,
      totalPages: 1,
    }), { status: 200 })));
    await expect(listAuditEvents("token", "org", { page: 0, size: 50 }))
      .rejects.toThrow("invalid staff audit response");
  });

  it("accepts owner-only staff access events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ ...auditEvent, category: "STAFF", entityType: "MANAGER_MEMBERSHIP" }],
      page: 0,
      size: 50,
      totalItems: 1,
      totalPages: 1,
    }), { status: 200 })));
    await expect(listAuditEvents("token", "org", { category: "STAFF", page: 0, size: 50 }))
      .resolves.toMatchObject({ items: [{ category: "STAFF" }] });
  });
});
