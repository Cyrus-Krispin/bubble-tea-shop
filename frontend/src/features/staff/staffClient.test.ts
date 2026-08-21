import { afterEach, describe, expect, it, vi } from "vitest";

import { getStaffContext, StaffContextError } from "./staffClient";

const context = {
  accountId: "35f942a3-0591-4973-83ef-8889f608184e",
  memberships: [{
    organizationId: "88b23060-cbc4-4218-9938-63d75f6f324c",
    organizationName: "Bubble Tea Operations",
    role: "OWNER" as const,
    locations: [{
      id: "42eeb769-306a-4b1a-97cc-350e2e9ea90b",
      name: "Orchard Central",
      timezone: "Asia/Singapore",
      defaultLocale: "en-SG",
      currencyCode: "SGD",
    }],
  }],
};

afterEach(() => vi.unstubAllGlobals());

describe("staffClient", () => {
  it("loads and validates staff scope through Spring with the access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(context), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getStaffContext("verified-access-token")).resolves.toEqual(context);
    const request = fetchMock.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    expect((request as Request).url).toBe("http://localhost:3000/api/v1/staff/context");
    expect((request as Request).headers.get("authorization"))
      .toBe("Bearer verified-access-token");
  });

  it("rejects malformed responses instead of inventing staff scope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accountId: "id", memberships: "OWNER" }), { status: 200 }),
    ));

    await expect(getStaffContext("token")).rejects.toThrow("invalid staff context response");
  });

  it("preserves stable problem codes without exposing response details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "STAFF_ACCESS_DENIED",
      detail: "internal detail that must not become the client message",
    }), { status: 403 })));

    await expect(getStaffContext("token")).rejects.toEqual(
      new StaffContextError("STAFF_ACCESS_DENIED", 403),
    );
  });
});
