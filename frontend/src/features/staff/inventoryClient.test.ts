import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getInventoryBalances,
  getInventoryMovements,
  InventoryError,
  recordInventoryMovement,
} from "./inventoryClient";

const movement = {
  id: "movement-id",
  ingredientId: "ingredient-id",
  ingredientName: "Assam Tea",
  baseUnit: "GRAM" as const,
  movementType: "RECEIPT" as const,
  quantityDelta: "10.500000",
  customerOrderId: null,
  sourceReference: "PO-42",
  note: null,
  totalCostMinor: 1299,
  currencyCode: "SGD",
  createdAt: "2026-08-22T00:00:00Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("inventoryClient", () => {
  it("lists balances and movement history within the authorized path scope", async () => {
    const balancePage = {
      items: [
        {
          ingredientId: "ingredient-id",
          ingredientName: "Assam Tea",
          sku: "TEA-001",
          baseUnit: "GRAM" as const,
          quantity: "10.500000",
          reorderThreshold: "5.000000",
          belowReorderThreshold: false,
          version: 1,
          openingRecorded: true,
          ingredientArchived: false,
          updatedAt: "2026-08-22T00:00:00Z",
        },
      ],
      page: 0,
      size: 25,
      totalItems: 1,
      totalPages: 1,
    };
    const movementPage = {
      items: [movement],
      page: 0,
      size: 25,
      totalItems: 1,
      totalPages: 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(balancePage), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(movementPage), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getInventoryBalances("token", "org/id", "location/id", {
        includeArchived: true,
        page: 0,
        query: "tea & milk",
        size: 25,
      }),
    ).resolves.toEqual(balancePage);
    await expect(
      getInventoryMovements("token", "org/id", "location/id", {
        ingredientId: "ingredient-id",
        movementType: "RECEIPT",
        page: 1,
        size: 25,
      }),
    ).resolves.toEqual(movementPage);

    const requests = fetchMock.mock.calls.map(([input]) => input as Request);
    expect(requests[0]?.url).toBe(
      "http://localhost:3000/api/v1/staff/organizations/org%2Fid/locations/location%2Fid/inventory/balances?page=0&size=25&query=tea%20%26%20milk&includeArchived=true",
    );
    expect(requests[1]?.url).toBe(
      "http://localhost:3000/api/v1/staff/organizations/org%2Fid/locations/location%2Fid/inventory/movements?ingredientId=ingredient-id&movementType=RECEIPT&page=1&size=25",
    );
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer token");
  });

  it("records only fields from the generated movement input", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(movement), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      recordInventoryMovement("token", "org", "location", {
        ingredientId: "ingredient-id",
        movementType: "RECEIPT",
        quantityDelta: "10.500000",
        sourceReference: "PO-42",
        totalCostMinor: 1299,
      }),
    ).resolves.toEqual(movement);

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.method).toBe("POST");
    expect(await request.clone().json()).toEqual({
      ingredientId: "ingredient-id",
      movementType: "RECEIPT",
      quantityDelta: "10.500000",
      sourceReference: "PO-42",
      totalCostMinor: 1299,
    });
  });

  it("rejects malformed successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ ...movement, totalCostMinor: "1299" }),
            { status: 201 },
          ),
        ),
    );

    await expect(
      recordInventoryMovement("token", "org", "location", {
        ingredientId: "ingredient-id",
        movementType: "RECEIPT",
        quantityDelta: "10",
      }),
    ).rejects.toThrow("invalid inventory response");
  });

  it("preserves stable problem codes, status, and shortage details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "INVENTORY_INSUFFICIENT_STOCK",
            shortages: {
              "ingredient-id": {
                requested: "12.000000",
                available: "4.000000",
              },
            },
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );

    await expect(
      recordInventoryMovement("token", "org", "location", {
        ingredientId: "ingredient-id",
        movementType: "ADJUSTMENT",
        quantityDelta: "-12",
        note: "Waste",
      }),
    ).rejects.toEqual(
      new InventoryError("INVENTORY_INSUFFICIENT_STOCK", 409, {
        "ingredient-id": { requested: "12.000000", available: "4.000000" },
      }),
    );
  });
});
