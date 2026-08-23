import createClient from "openapi-fetch";

import type { components, paths } from "../../api/generated";

type Schemas = components["schemas"];

export type StaffRole = Schemas["StaffMembership"]["role"];
export type StaffLocation = Schemas["StaffLocation"];
export type StaffMembership = Schemas["StaffMembership"];
export type StaffContext = Schemas["StaffContext"];

export type StaffContextErrorCode =
  | "STAFF_IDENTITY_INVALID"
  | "STAFF_ACCESS_DENIED"
  | "STAFF_ACCOUNT_DISABLED"
  | "STAFF_CONTEXT_UNAVAILABLE";

export class StaffContextError extends Error {
  constructor(public code: StaffContextErrorCode, public status: number) {
    super(code);
    this.name = "StaffContextError";
  }
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as JsonObject;
}

function string(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value;
}

function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) invalid();
  return value.map(parse);
}

function invalid(): never {
  throw new Error("invalid staff context response");
}

function role(value: unknown): StaffRole {
  if (value !== "OWNER" && value !== "MANAGER") invalid();
  return value;
}

function location(value: unknown): StaffLocation {
  const input = object(value);
  return {
    id: string(input.id),
    name: string(input.name),
    timezone: string(input.timezone),
    defaultLocale: string(input.defaultLocale),
    currencyCode: string(input.currencyCode),
  };
}

function membership(value: unknown): StaffMembership {
  const input = object(value);
  return {
    organizationId: string(input.organizationId),
    organizationName: string(input.organizationName),
    role: role(input.role),
    locations: array(input.locations, location),
  };
}

function context(value: unknown): StaffContext {
  const input = object(value);
  return {
    accountId: string(input.accountId),
    memberships: array(input.memberships, membership),
  };
}

function knownProblemCode(value: unknown): StaffContextErrorCode {
  if (
    value === "STAFF_IDENTITY_INVALID"
    || value === "STAFF_ACCESS_DENIED"
    || value === "STAFF_ACCOUNT_DISABLED"
  ) {
    return value;
  }
  return "STAFF_CONTEXT_UNAVAILABLE";
}

export async function getStaffContext(
  accessToken: string,
  signal?: AbortSignal,
): Promise<StaffContext> {
  const client = createClient<paths>({ baseUrl: window.location.origin });
  const { data, error, response } = await client.GET("/api/v1/staff/context", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });

  if (data === undefined) {
    let code: StaffContextErrorCode = "STAFF_CONTEXT_UNAVAILABLE";
    try {
      const problem = object(error);
      const properties = problem.properties === undefined ? undefined : object(problem.properties);
      code = knownProblemCode(properties?.code ?? problem.code);
    } catch {
      // A malformed error body is intentionally reduced to a generic client state.
    }
    throw new StaffContextError(code, response.status);
  }

  return context(data);
}
