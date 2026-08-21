import createClient from "openapi-fetch";

import type { components, paths } from "../../api/generated";

type Schemas = components["schemas"];

export type InventoryBalance = Schemas["StaffInventoryBalance"];
export type InventoryBalancePage = Schemas["StaffInventoryBalancePage"];
export type InventoryMovement = Schemas["StaffInventoryMovement"];
export type InventoryMovementPage = Schemas["StaffInventoryMovementPage"];
export type CreateInventoryMovementInput =
  Schemas["CreateInventoryMovementRequest"];
export type InventoryMovementType = InventoryMovement["movementType"];
export type ManualInventoryMovementType =
  CreateInventoryMovementInput["movementType"];

export type InventoryErrorCode =
  | "INVENTORY_INVALID"
  | "INVENTORY_NOT_FOUND"
  | "INVENTORY_STATE_CONFLICT"
  | "INVENTORY_INSUFFICIENT_STOCK"
  | "STAFF_IDENTITY_INVALID"
  | "STAFF_ACCESS_DENIED"
  | "STAFF_ACCOUNT_DISABLED"
  | "INVENTORY_UNAVAILABLE";

export type InventoryShortage = { available: string; requested: string };

export class InventoryError extends Error {
  constructor(
    public code: InventoryErrorCode,
    public status: number,
    public shortages: Readonly<Record<string, InventoryShortage>> = {},
  ) {
    super(code);
    this.name = "InventoryError";
  }
}

export type InventoryBalanceFilters = {
  includeArchived?: boolean;
  page: number;
  query?: string;
  size: number;
};

export type InventoryMovementFilters = {
  ingredientId?: string;
  movementType?: InventoryMovementType;
  page: number;
  size: number;
};

type JsonObject = Record<string, unknown>;

function invalid(): never {
  throw new Error("invalid inventory response");
}

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    invalid();
  return value as JsonObject;
}

function string(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null ? null : string(value);
}

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    invalid();
  return value;
}

function nullableInteger(value: unknown): number | null {
  return value === null ? null : integer(value);
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function baseUnit(value: unknown): InventoryBalance["baseUnit"] {
  if (value !== "GRAM" && value !== "MILLILITER" && value !== "EACH") invalid();
  return value;
}

function movementType(value: unknown): InventoryMovementType {
  if (
    value !== "OPENING" &&
    value !== "RECEIPT" &&
    value !== "SALE" &&
    value !== "REVERSAL" &&
    value !== "ADJUSTMENT"
  )
    invalid();
  return value;
}

function parseBalance(value: unknown): InventoryBalance {
  const input = object(value);
  return {
    ingredientId: string(input.ingredientId),
    ingredientName: string(input.ingredientName),
    sku: nullableString(input.sku),
    baseUnit: baseUnit(input.baseUnit),
    quantity: string(input.quantity),
    reorderThreshold: nullableString(input.reorderThreshold),
    belowReorderThreshold: boolean(input.belowReorderThreshold),
    version: integer(input.version),
    openingRecorded: boolean(input.openingRecorded),
    ingredientArchived: boolean(input.ingredientArchived),
    updatedAt: nullableString(input.updatedAt),
  };
}

function parseMovement(value: unknown): InventoryMovement {
  const input = object(value);
  return {
    id: string(input.id),
    ingredientId: string(input.ingredientId),
    ingredientName: string(input.ingredientName),
    baseUnit: baseUnit(input.baseUnit),
    movementType: movementType(input.movementType),
    quantityDelta: string(input.quantityDelta),
    customerOrderId: nullableString(input.customerOrderId),
    sourceReference: nullableString(input.sourceReference),
    note: nullableString(input.note),
    totalCostMinor: nullableInteger(input.totalCostMinor),
    currencyCode: nullableString(input.currencyCode),
    createdAt: string(input.createdAt),
  };
}

function parsePage<T>(value: unknown, parseItem: (item: unknown) => T) {
  const input = object(value);
  if (!Array.isArray(input.items)) invalid();
  return {
    items: input.items.map(parseItem),
    page: integer(input.page),
    size: integer(input.size),
    totalItems: integer(input.totalItems),
    totalPages: integer(input.totalPages),
  };
}

function knownCode(value: unknown): InventoryErrorCode {
  if (
    value === "INVENTORY_INVALID" ||
    value === "INVENTORY_NOT_FOUND" ||
    value === "INVENTORY_STATE_CONFLICT" ||
    value === "INVENTORY_INSUFFICIENT_STOCK" ||
    value === "STAFF_IDENTITY_INVALID" ||
    value === "STAFF_ACCESS_DENIED" ||
    value === "STAFF_ACCOUNT_DISABLED"
  )
    return value;
  return "INVENTORY_UNAVAILABLE";
}

function parseShortages(value: unknown): Record<string, InventoryShortage> {
  if (value === undefined) return {};
  const entries = Object.entries(object(value));
  return Object.fromEntries(
    entries.map(([ingredientId, raw]) => {
      const shortage = object(raw);
      return [
        ingredientId,
        {
          requested: string(shortage.requested),
          available: string(shortage.available),
        },
      ];
    }),
  );
}

function apiError(error: unknown, status: number): InventoryError {
  let code: InventoryErrorCode = "INVENTORY_UNAVAILABLE";
  let shortages: Record<string, InventoryShortage> = {};
  try {
    const problem = object(error);
    const properties =
      problem.properties === undefined ? undefined : object(problem.properties);
    code = knownCode(properties?.code ?? problem.code);
    shortages = parseShortages(properties?.shortages ?? problem.shortages);
  } catch {
    // Malformed problem details are reduced to a safe generic state.
  }
  return new InventoryError(code, status, shortages);
}

function client(accessToken: string) {
  return createClient<paths>({
    baseUrl: window.location.origin,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getInventoryBalances(
  accessToken: string,
  organizationId: string,
  locationId: string,
  filters: InventoryBalanceFilters,
  signal?: AbortSignal,
): Promise<InventoryBalancePage> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/inventory/balances",
    {
      params: {
        path: { organizationId, locationId },
        query: {
          page: filters.page,
          size: filters.size,
          query: filters.query,
          includeArchived: filters.includeArchived ?? false,
        },
      },
      signal,
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parsePage(data, parseBalance);
}

export async function getInventoryMovements(
  accessToken: string,
  organizationId: string,
  locationId: string,
  filters: InventoryMovementFilters,
  signal?: AbortSignal,
): Promise<InventoryMovementPage> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/inventory/movements",
    {
      params: {
        path: { organizationId, locationId },
        query: filters,
      },
      signal,
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parsePage(data, parseMovement);
}

export async function recordInventoryMovement(
  accessToken: string,
  organizationId: string,
  locationId: string,
  input: CreateInventoryMovementInput,
): Promise<InventoryMovement> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/inventory/movements",
    { params: { path: { organizationId, locationId } }, body: input },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseMovement(data);
}
