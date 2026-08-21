import createClient from "openapi-fetch";

import type { components, paths } from "../../api/generated";

type Schemas = components["schemas"];

export type AuditEvent = Schemas["AuditEvent"];
export type AuditPage = Schemas["AuditPage"];
export type AuditCategory = AuditEvent["category"];

export type AuditErrorCode =
  | "STAFF_IDENTITY_INVALID"
  | "STAFF_ACCESS_DENIED"
  | "STAFF_ACCOUNT_DISABLED"
  | "AUDIT_UNAVAILABLE";

export class AuditError extends Error {
  constructor(public code: AuditErrorCode, public status: number) {
    super(code);
    this.name = "AuditError";
  }
}

type JsonObject = Record<string, unknown>;

function invalid(): never {
  throw new Error("invalid staff audit response");
}

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
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
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) invalid();
  return value;
}

function positiveInteger(value: unknown): number {
  const parsed = integer(value);
  if (parsed === 0) invalid();
  return parsed;
}

function category(value: unknown): AuditCategory {
  if (value !== "CATALOG" && value !== "INVENTORY" && value !== "ORDER" && value !== "STAFF") invalid();
  return value;
}

function event(value: unknown): AuditEvent {
  const input = object(value);
  return {
    id: string(input.id),
    category: category(input.category),
    action: string(input.action),
    entityType: string(input.entityType),
    entityId: string(input.entityId),
    entityLabel: string(input.entityLabel),
    locationId: nullableString(input.locationId),
    locationName: nullableString(input.locationName),
    actorAccountId: nullableString(input.actorAccountId),
    actorLabel: nullableString(input.actorLabel),
    occurredAt: string(input.occurredAt),
    detail: nullableString(input.detail),
  };
}

function page(value: unknown): AuditPage {
  const input = object(value);
  if (!Array.isArray(input.items)) invalid();
  return {
    items: input.items.map(event),
    page: integer(input.page),
    size: positiveInteger(input.size),
    totalItems: integer(input.totalItems),
    totalPages: integer(input.totalPages),
  };
}

function knownCode(value: unknown): AuditErrorCode {
  if (
    value === "STAFF_IDENTITY_INVALID"
    || value === "STAFF_ACCESS_DENIED"
    || value === "STAFF_ACCOUNT_DISABLED"
  ) return value;
  return "AUDIT_UNAVAILABLE";
}

function apiError(error: unknown, status: number): AuditError {
  let code: AuditErrorCode = "AUDIT_UNAVAILABLE";
  try {
    const problem = object(error);
    const properties = problem.properties === undefined ? undefined : object(problem.properties);
    code = knownCode(properties?.code ?? problem.code);
  } catch {
    // Malformed problem details are intentionally reduced to a generic state.
  }
  return new AuditError(code, status);
}

export async function listAuditEvents(
  accessToken: string,
  organizationId: string,
  filters: { category?: AuditCategory; page: number; size: number },
  signal?: AbortSignal,
): Promise<AuditPage> {
  const client = createClient<paths>({
    baseUrl: window.location.origin,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const { data, error, response } = await client.GET(
    "/api/v1/staff/organizations/{organizationId}/audit-events",
    {
      params: { path: { organizationId }, query: filters },
      signal,
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return page(data);
}
