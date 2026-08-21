import createClient from "openapi-fetch";

import type { components, paths } from "../../api/generated";

type Schemas = components["schemas"];

export type ManagerPage = Schemas["ManagerPage"];
export type ManagerSummary = Schemas["ManagerSummary"];
export type ManagerLocation = Schemas["ManagerLocation"];

export type ManagerErrorCode =
  | "MANAGER_INVALID"
  | "MANAGER_ACCOUNT_NOT_FOUND"
  | "MANAGER_NOT_FOUND"
  | "MANAGER_CONFLICT"
  | "MANAGER_VERSION_CONFLICT"
  | "STAFF_IDENTITY_INVALID"
  | "STAFF_ACCESS_DENIED"
  | "STAFF_ACCOUNT_DISABLED"
  | "MANAGER_UNAVAILABLE";

export class ManagerError extends Error {
  constructor(public code: ManagerErrorCode, public status: number) {
    super(code);
    this.name = "ManagerError";
  }
}

type JsonObject = Record<string, unknown>;

function invalid(): never {
  throw new Error("invalid manager response");
}

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as JsonObject;
}

function string(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) invalid();
  return value;
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

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) invalid();
  return value.map(parse);
}

function location(value: unknown): ManagerLocation {
  const input = object(value);
  return { id: string(input.id), name: string(input.name) };
}

function manager(value: unknown): ManagerSummary {
  const input = object(value);
  return {
    id: string(input.id),
    accountId: string(input.accountId),
    email: string(input.email),
    active: boolean(input.active),
    version: integer(input.version),
    locations: array(input.locations, location),
    createdAt: string(input.createdAt),
    updatedAt: string(input.updatedAt),
  };
}

function page(value: unknown): ManagerPage {
  const input = object(value);
  return {
    items: array(input.items, manager),
    page: integer(input.page),
    size: positiveInteger(input.size),
    totalItems: integer(input.totalItems),
    totalPages: integer(input.totalPages),
  };
}

function knownCode(value: unknown): ManagerErrorCode {
  if (
    value === "MANAGER_INVALID"
    || value === "MANAGER_ACCOUNT_NOT_FOUND"
    || value === "MANAGER_NOT_FOUND"
    || value === "MANAGER_CONFLICT"
    || value === "MANAGER_VERSION_CONFLICT"
    || value === "STAFF_IDENTITY_INVALID"
    || value === "STAFF_ACCESS_DENIED"
    || value === "STAFF_ACCOUNT_DISABLED"
  ) return value;
  return "MANAGER_UNAVAILABLE";
}

function apiError(error: unknown, status: number): ManagerError {
  let code: ManagerErrorCode = "MANAGER_UNAVAILABLE";
  try {
    const problem = object(error);
    const properties = problem.properties === undefined ? undefined : object(problem.properties);
    code = knownCode(properties?.code ?? problem.code);
  } catch {
    // Malformed problem details are intentionally reduced to a generic state.
  }
  return new ManagerError(code, status);
}

function client(accessToken: string) {
  return createClient<paths>({
    baseUrl: window.location.origin,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function listManagers(
  accessToken: string,
  organizationId: string,
  filters: { page: number; size: number },
  signal?: AbortSignal,
): Promise<ManagerPage> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/managers",
    { params: { path: { organizationId }, query: filters }, signal },
  );
  if (data === undefined) throw apiError(error, response.status);
  return page(data);
}

export async function addOrReactivateManager(
  accessToken: string,
  organizationId: string,
  request: { email: string; locationIds: readonly string[] },
): Promise<ManagerSummary> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/managers",
    { params: { path: { organizationId } }, body: request },
  );
  if (data === undefined) throw apiError(error, response.status);
  return manager(data);
}

export async function replaceManagerAssignments(
  accessToken: string,
  organizationId: string,
  membershipId: string,
  version: number,
  locationIds: readonly string[],
): Promise<ManagerSummary> {
  const { data, error, response } = await client(accessToken).PUT(
    "/api/v1/staff/organizations/{organizationId}/managers/{membershipId}/assignments",
    {
      params: { path: { organizationId, membershipId } },
      body: { version, locationIds },
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return manager(data);
}

export async function deactivateManager(
  accessToken: string,
  organizationId: string,
  membershipId: string,
  version: number,
): Promise<ManagerSummary> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/managers/{membershipId}/deactivate",
    { params: { path: { organizationId, membershipId } }, body: { version } },
  );
  if (data === undefined) throw apiError(error, response.status);
  return manager(data);
}
