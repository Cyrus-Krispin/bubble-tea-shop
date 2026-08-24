import createClient from "openapi-fetch";

import type { components, paths } from "../../api/generated";

type Schemas = components["schemas"];

export type CustomerOrderPage = Schemas["CustomerOrderPage"];
export type CustomerOrderSummary = Schemas["CustomerOrderSummary"];
export type CustomerOrderDetail = Schemas["CustomerOrderDetail"];
export type CustomerOrderLine = Schemas["CustomerOrderLine"];
export type CustomerOrderOption = Schemas["CustomerOrderOption"];
export type CustomerReorderSuggestion = Schemas["CustomerReorderSuggestion"];
export type CustomerReorderLine = Schemas["CustomerReorderLine"];
export type CustomerReorderSelection = Schemas["CustomerReorderSelection"];
export type CustomerOrderStatus = CustomerOrderSummary["status"];

export type CustomerOrderErrorCode =
  | "CUSTOMER_ORDER_HISTORY_INVALID"
  | "CUSTOMER_ACCOUNT_UNAVAILABLE"
  | "CUSTOMER_ORDER_NOT_FOUND"
  | "CUSTOMER_IDENTITY_INVALID"
  | "CUSTOMER_ORDER_HISTORY_UNAVAILABLE";

export class CustomerOrderError extends Error {
  constructor(public code: CustomerOrderErrorCode, public status: number) {
    super(code);
    this.name = "CustomerOrderError";
  }
}

type JsonObject = Record<string, unknown>;

function invalid(): never {
  throw new Error("invalid customer order response");
}

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as JsonObject;
}

function string(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) invalid();
  return value;
}

function instant(value: unknown): string {
  const parsed = string(value);
  if (Number.isNaN(Date.parse(parsed))) invalid();
  return parsed;
}

function nullableInstant(value: unknown): string | null {
  return value === null ? null : instant(value);
}

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) invalid();
  return value;
}

function positiveInteger(value: unknown): number {
  const result = integer(value);
  if (result === 0) invalid();
  return result;
}

function signedInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) invalid();
  return value;
}

function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) invalid();
  return value.map(parse);
}

function status(value: unknown): CustomerOrderStatus {
  if (value !== "PENDING" && value !== "COMPLETED" && value !== "CANCELLED") invalid();
  return value;
}

function location(value: unknown): Schemas["CustomerOrderLocation"] {
  const input = object(value);
  return { id: string(input.id), slug: string(input.slug), name: string(input.name) };
}

function itemSummary(value: unknown): Schemas["CustomerOrderItemSummary"] {
  const input = object(value);
  return {
    productName: string(input.productName),
    variantName: string(input.variantName),
    quantity: positiveInteger(input.quantity),
  };
}

function summary(value: unknown): CustomerOrderSummary {
  const input = object(value);
  return {
    id: string(input.id),
    publicOrderNumber: string(input.publicOrderNumber),
    status: status(input.status),
    paymentMethod: string(input.paymentMethod),
    currencyCode: string(input.currencyCode),
    totalMinor: integer(input.totalMinor),
    itemQuantity: positiveInteger(input.itemQuantity),
    createdAt: instant(input.createdAt),
    completedAt: nullableInstant(input.completedAt),
    cancelledAt: nullableInstant(input.cancelledAt),
    location: location(input.location),
    items: array(input.items, itemSummary),
  };
}

function option(value: unknown): CustomerOrderOption {
  const input = object(value);
  return {
    selectionNumber: positiveInteger(input.selectionNumber),
    groupName: string(input.groupName),
    choiceName: string(input.choiceName),
    priceDeltaMinor: signedInteger(input.priceDeltaMinor),
  };
}

function line(value: unknown): CustomerOrderLine {
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

function detail(value: unknown): CustomerOrderDetail {
  const input = object(value);
  return {
    id: string(input.id),
    publicOrderNumber: string(input.publicOrderNumber),
    status: status(input.status),
    paymentMethod: string(input.paymentMethod),
    currencyCode: string(input.currencyCode),
    subtotalMinor: integer(input.subtotalMinor),
    totalMinor: integer(input.totalMinor),
    createdAt: instant(input.createdAt),
    completedAt: nullableInstant(input.completedAt),
    cancelledAt: nullableInstant(input.cancelledAt),
    location: location(input.location),
    items: array(input.items, line),
  };
}

function reorderSelection(value: unknown): CustomerReorderSelection {
  const input = object(value);
  const choiceIds = array(input.choiceIds, string);
  const choiceNames = array(input.choiceNames, string);
  if (choiceIds.length !== choiceNames.length) invalid();
  return {
    groupId: string(input.groupId),
    groupName: string(input.groupName),
    choiceIds,
    choiceNames,
  };
}

function reorderLine(value: unknown): CustomerReorderLine {
  const input = object(value);
  return {
    productSlug: string(input.productSlug),
    productName: string(input.productName),
    variantId: string(input.variantId),
    variantName: string(input.variantName),
    quantity: positiveInteger(input.quantity),
    unitPriceMinor: integer(input.unitPriceMinor),
    selections: array(input.selections, reorderSelection),
  };
}

function reorderSuggestion(value: unknown): CustomerReorderSuggestion {
  const input = object(value);
  const items = array(input.items, reorderLine);
  if (items.length === 0) invalid();
  return {
    orderId: string(input.orderId),
    publicOrderNumber: string(input.publicOrderNumber),
    createdAt: instant(input.createdAt),
    location: location(input.location),
    currencyCode: string(input.currencyCode),
    totalMinor: integer(input.totalMinor),
    items,
  };
}

function page(value: unknown): CustomerOrderPage {
  const input = object(value);
  return {
    items: array(input.items, summary),
    page: integer(input.page),
    size: positiveInteger(input.size),
    totalItems: integer(input.totalItems),
    totalPages: integer(input.totalPages),
  };
}

function knownCode(value: unknown): CustomerOrderErrorCode {
  if (
    value === "CUSTOMER_ORDER_HISTORY_INVALID" ||
    value === "CUSTOMER_ACCOUNT_UNAVAILABLE" ||
    value === "CUSTOMER_ORDER_NOT_FOUND" ||
    value === "CUSTOMER_IDENTITY_INVALID"
  ) return value;
  return "CUSTOMER_ORDER_HISTORY_UNAVAILABLE";
}

function apiError(error: unknown, statusCode: number): CustomerOrderError {
  let code: CustomerOrderErrorCode = "CUSTOMER_ORDER_HISTORY_UNAVAILABLE";
  try {
    const problem = object(error);
    const properties = problem.properties === undefined ? undefined : object(problem.properties);
    code = knownCode(properties?.code ?? problem.code);
  } catch {
    // Malformed problem details are deliberately reduced to a safe generic error.
  }
  return new CustomerOrderError(code, statusCode);
}

function client(accessToken: string) {
  return createClient<paths>({
    baseUrl: window.location.origin,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function listCustomerOrders(
  accessToken: string,
  query: { page: number; size: number },
  signal?: AbortSignal,
): Promise<CustomerOrderPage> {
  const { data, error, response } = await client(accessToken).GET("/api/v1/customer/orders", {
    params: { query },
    signal,
  });
  if (data === undefined) throw apiError(error, response.status);
  return page(data);
}

export async function getCustomerOrder(
  accessToken: string,
  orderId: string,
  signal?: AbortSignal,
): Promise<CustomerOrderDetail> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/customer/orders/{orderId}",
    { params: { path: { orderId } }, signal },
  );
  if (data === undefined) throw apiError(error, response.status);
  return detail(data);
}

export async function getLatestCustomerReorder(
  accessToken: string,
  locationSlug: string,
  signal?: AbortSignal,
): Promise<CustomerReorderSuggestion | undefined> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/customer/orders/latest-reorder",
    { params: { query: { locationSlug } }, signal },
  );
  if (response.status === 204) return undefined;
  if (data === undefined) throw apiError(error, response.status);
  return reorderSuggestion(data);
}
