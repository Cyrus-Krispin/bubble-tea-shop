import createClient from "openapi-fetch";

import type { components, paths } from "../../api/generated";

type Schemas = components["schemas"];

export type StaffOrderPage = Schemas["OrderPage"];
export type StaffOrderSummary = Schemas["OrderSummary"];
export type StaffOrderDetail = Schemas["OrderDetail"];
export type StaffOrderStatus = StaffOrderSummary["status"];
export type StaffOrderLine = Schemas["OrderLine"];
export type StaffOrderOption = Schemas["OrderOption"];
export type StockRequirement = Schemas["StockRequirement"];

export type OrderOperationErrorCode =
  | "ORDER_INVALID"
  | "ORDER_NOT_FOUND"
  | "ORDER_STATE_CONFLICT"
  | "ORDER_INSUFFICIENT_STOCK"
  | "STAFF_IDENTITY_INVALID"
  | "STAFF_ACCESS_DENIED"
  | "STAFF_ACCOUNT_DISABLED"
  | "ORDER_UNAVAILABLE";

export type OrderShortage = Omit<StockRequirement, "sufficient">;

export class OrderOperationError extends Error {
  constructor(
    public code: OrderOperationErrorCode,
    public status: number,
    public shortages: readonly OrderShortage[] = [],
  ) {
    super(code);
    this.name = "OrderOperationError";
  }
}

type JsonObject = Record<string, unknown>;
const QUANTITY = /^(0|[0-9]+)(\.[0-9]{1,6})?$/;

function invalid(): never {
  throw new Error("invalid staff order response");
}

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    invalid();
  return value as JsonObject;
}

function string(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) invalid();
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

function positiveInteger(value: unknown): number {
  const parsed = integer(value);
  if (parsed === 0) invalid();
  return parsed;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) invalid();
  return value.map(parse);
}

function orderStatus(value: unknown): StaffOrderStatus {
  if (value !== "PENDING" && value !== "COMPLETED" && value !== "CANCELLED")
    invalid();
  return value;
}

function paymentMethod(value: unknown): string {
  if (value !== "CASH") invalid();
  return value;
}

function paymentStatus(value: unknown): string {
  if (value !== "PENDING" && value !== "PAID") invalid();
  return value;
}

function quantity(value: unknown): string {
  const parsed = string(value);
  if (!QUANTITY.test(parsed)) invalid();
  return parsed;
}

function option(value: unknown): StaffOrderOption {
  const input = object(value);
  return {
    selectionNumber: positiveInteger(input.selectionNumber),
    groupName: string(input.groupName),
    choiceName: string(input.choiceName),
    priceDeltaMinor:
      typeof input.priceDeltaMinor === "number" &&
      Number.isSafeInteger(input.priceDeltaMinor)
        ? input.priceDeltaMinor
        : invalid(),
  };
}

function line(value: unknown): StaffOrderLine {
  const input = object(value);
  return {
    lineNumber: positiveInteger(input.lineNumber),
    productName: string(input.productName),
    variantName: string(input.variantName),
    quantity: positiveInteger(input.quantity),
    unitPriceMinor: integer(input.unitPriceMinor),
    lineTotalMinor: integer(input.lineTotalMinor),
    options: array(input.options, option),
  };
}

function requirement(value: unknown): StockRequirement {
  const input = object(value);
  return {
    ingredientId: string(input.ingredientId),
    ingredientName: string(input.ingredientName),
    baseUnit: string(input.baseUnit),
    requiredQuantity: quantity(input.requiredQuantity),
    availableQuantity: quantity(input.availableQuantity),
    sufficient: boolean(input.sufficient),
  };
}

function shortage(value: unknown): OrderShortage {
  const input = object(value);
  return {
    ingredientId: string(input.ingredientId),
    ingredientName: string(input.ingredientName),
    baseUnit: string(input.baseUnit),
    requiredQuantity: quantity(input.requiredQuantity),
    availableQuantity: quantity(input.availableQuantity),
  };
}

function summary(value: unknown): StaffOrderSummary {
  const input = object(value);
  return {
    id: string(input.id),
    publicOrderNumber: string(input.publicOrderNumber),
    status: orderStatus(input.status),
    paymentMethod: paymentMethod(input.paymentMethod),
    paymentStatus: paymentStatus(input.paymentStatus),
    currencyCode: string(input.currencyCode),
    totalMinor: integer(input.totalMinor),
    itemQuantity: integer(input.itemQuantity),
    createdAt: string(input.createdAt),
    completedAt: nullableString(input.completedAt),
  };
}

function detail(value: unknown): StaffOrderDetail {
  const input = object(value);
  return {
    id: string(input.id),
    publicOrderNumber: string(input.publicOrderNumber),
    status: orderStatus(input.status),
    paymentMethod: paymentMethod(input.paymentMethod),
    paymentStatus: paymentStatus(input.paymentStatus),
    currencyCode: string(input.currencyCode),
    subtotalMinor: integer(input.subtotalMinor),
    totalMinor: integer(input.totalMinor),
    createdAt: string(input.createdAt),
    completedAt: nullableString(input.completedAt),
    paidAt: nullableString(input.paidAt),
    lines: array(input.lines, line),
    requirements: array(input.requirements, requirement),
  };
}

function page(value: unknown): StaffOrderPage {
  const input = object(value);
  return {
    items: array(input.items, summary),
    page: integer(input.page),
    size: positiveInteger(input.size),
    totalItems: integer(input.totalItems),
    totalPages: integer(input.totalPages),
  };
}

function knownCode(value: unknown): OrderOperationErrorCode {
  if (
    value === "ORDER_INVALID" ||
    value === "ORDER_NOT_FOUND" ||
    value === "ORDER_STATE_CONFLICT" ||
    value === "ORDER_INSUFFICIENT_STOCK" ||
    value === "STAFF_IDENTITY_INVALID" ||
    value === "STAFF_ACCESS_DENIED" ||
    value === "STAFF_ACCOUNT_DISABLED"
  )
    return value;
  return "ORDER_UNAVAILABLE";
}

function apiError(error: unknown, status: number): OrderOperationError {
  let code: OrderOperationErrorCode = "ORDER_UNAVAILABLE";
  let shortages: OrderShortage[] = [];
  try {
    const problem = object(error);
    const properties =
      problem.properties === undefined ? undefined : object(problem.properties);
    code = knownCode(properties?.code ?? problem.code);
    const rawShortages = properties?.shortages ?? problem.shortages;
    if (rawShortages !== undefined) shortages = array(rawShortages, shortage);
  } catch {
    // Malformed problem details are reduced to a safe generic state.
  }
  return new OrderOperationError(code, status, shortages);
}

function client(accessToken: string) {
  return createClient<paths>({
    baseUrl: window.location.origin,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function listStaffOrders(
  accessToken: string,
  organizationId: string,
  locationId: string,
  filters: { status?: StaffOrderStatus; page: number; size: number },
  signal?: AbortSignal,
): Promise<StaffOrderPage> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/orders",
    {
      params: { path: { organizationId, locationId }, query: filters },
      signal,
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return page(data);
}

export async function getStaffOrder(
  accessToken: string,
  organizationId: string,
  locationId: string,
  orderId: string,
  signal?: AbortSignal,
): Promise<StaffOrderDetail> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/orders/{orderId}",
    { params: { path: { organizationId, locationId, orderId } }, signal },
  );
  if (data === undefined) throw apiError(error, response.status);
  return detail(data);
}

export async function completeStaffOrder(
  accessToken: string,
  organizationId: string,
  locationId: string,
  orderId: string,
): Promise<StaffOrderDetail> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/orders/{orderId}/completion",
    { params: { path: { organizationId, locationId, orderId } } },
  );
  if (data === undefined) throw apiError(error, response.status);
  return detail(data);
}
