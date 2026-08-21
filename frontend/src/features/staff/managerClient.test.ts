import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addOrReactivateManager,
  listManagers,
  replaceManagerAssignments,
} from "./managerClient";

const manager = {
  id: "membership-id",
  accountId: "account-id",
  email: "manager@example.test",
  active: true,
  version: 0,
  locations: [{ id: "location-id", name: "Orchard Central" }],
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("managerClient", () => {
  it("loads a bearer-authorized owner page and validates it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [manager], page: 0, size: 25, totalItems: 1, totalPages: 1,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listManagers("token", "org", { page: 0, size: 25 }))
      .resolves.toMatchObject({ items: [manager] });
    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.headers.get("authorization")).toBe("Bearer token");
    expect(new URL(request.url).pathname).toBe("/api/v1/staff/organizations/org/managers");
  });

  it("sends server-scoped manager mutations", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(manager), { status: 201 })));
    vi.stubGlobal("fetch", fetchMock);
    await addOrReactivateManager("token", "org", {
      email: "manager@example.test", locationIds: ["location-id"],
    });
    let request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ email: "manager@example.test", locationIds: ["location-id"] });

    await replaceManagerAssignments("token", "org", "membership-id", 0, ["south-id"]);
    request = fetchMock.mock.calls[1]?.[0] as Request;
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ version: 0, locationIds: ["south-id"] });
  });

  it("rejects malformed manager pages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ ...manager, active: "yes" }], page: 0, size: 25, totalItems: 1, totalPages: 1,
    }), { status: 200 })));
    await expect(listManagers("token", "org", { page: 0, size: 25 }))
      .rejects.toThrow("invalid manager response");
  });
});
