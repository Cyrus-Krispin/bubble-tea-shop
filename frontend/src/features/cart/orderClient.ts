import createClient from "openapi-fetch";

import type { components, paths } from "../../api/generated";

type Schemas = components["schemas"];

export type CreateGuestOrderInput = Schemas["CreateGuestOrderRequest"];
export type GuestOrder = Schemas["GuestOrder"];
export type GuestOrderLine = Schemas["GuestOrderLine"];
export type GuestOrderOption = Schemas["GuestOrderOption"];

export type OrderErrorCode =
  | "ORDER_INVALID"
  | "ORDER_CATALOG_CHANGED"
  | "ORDER_IDEMPOTENCY_CONFLICT"
  | "CUSTOMER_ACCOUNT_DISABLED"
  | "ORDER_UNAVAILABLE";

export class OrderError extends Error {
  constructor(
    public code: OrderErrorCode,
    public status: number,
  ) {
    super(code);
    this.name = "OrderError";
  }
}

type JsonObject = Record<string, unknown>;

function invalid(): never {
  throw new Error("invalid order response");
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

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    invalid();
  return value;
}

function signedInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) invalid();
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) invalid();
  return value.map(parse);
}

function option(value: unknown): GuestOrderOption {
  const input = object(value);
  return {
    groupName: string(input.groupName),
    choiceName: string(input.choiceName),
    priceDeltaMinor: signedInteger(input.priceDeltaMinor),
  };
}

function line(value: unknown): GuestOrderLine {
  const input = object(value);
  return {
    productName: string(input.productName),
    variantName: string(input.variantName),
    quantity: integer(input.quantity),
    unitPriceMinor: integer(input.unitPriceMinor),
    lineTotalMinor: integer(input.lineTotalMinor),
    options: array(input.options, option),
  };
}

function order(value: unknown): GuestOrder {
  const input = object(value);
  if (input.status !== "PENDING" || input.paymentMethod !== "CASH") invalid();
  return {
    id: string(input.id),
    publicOrderNumber: string(input.publicOrderNumber),
    status: "PENDING",
    paymentMethod: "CASH",
    currencyCode: string(input.currencyCode),
    subtotalMinor: integer(input.subtotalMinor),
    totalMinor: integer(input.totalMinor),
    createdAt: string(input.createdAt),
    replayed: boolean(input.replayed),
    items: array(input.items, line),
  };
}

function knownCode(value: unknown): OrderErrorCode {
  if (
    value === "ORDER_INVALID" ||
    value === "ORDER_CATALOG_CHANGED" ||
    value === "ORDER_IDEMPOTENCY_CONFLICT" ||
    value === "CUSTOMER_ACCOUNT_DISABLED"
  )
    return value;
  return "ORDER_UNAVAILABLE";
}

function apiError(error: unknown, status: number) {
  let code: OrderErrorCode = "ORDER_UNAVAILABLE";
  try {
    const problem = object(error);
    const properties =
      problem.properties === undefined ? undefined : object(problem.properties);
    code = knownCode(properties?.code ?? problem.code);
  } catch {
    // Malformed problem details are reduced to a safe generic state.
  }
  return new OrderError(code, status);
}

export async function placeGuestOrder(
  input: CreateGuestOrderInput,
  idempotencyKey: string,
  accessToken?: string,
): Promise<GuestOrder> {
  const client = createClient<paths>({ baseUrl: window.location.origin });
  const { data, error, response } = await client.POST("/api/v1/guest/orders", {
    params: { header: { "Idempotency-Key": idempotencyKey } },
    headers:
      accessToken === undefined
        ? undefined
        : { Authorization: `Bearer ${accessToken}` },
    body: input,
  });
  if (data === undefined) throw apiError(error, response.status);
  return order(data);
}
