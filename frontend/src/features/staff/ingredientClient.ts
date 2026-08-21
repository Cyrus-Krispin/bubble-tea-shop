import createClient from "openapi-fetch";

import type { components, paths } from "../../api/generated";

type Schemas = components["schemas"];

export type Ingredient = Schemas["Ingredient"];
export type IngredientPage = Schemas["IngredientPage"];
export type CreateIngredientInput = Schemas["CreateIngredientRequest"];
export type UpdateIngredientInput = Schemas["UpdateIngredientRequest"];
export type BaseUnit = Ingredient["baseUnit"];

export type IngredientErrorCode =
  | "INGREDIENT_INVALID"
  | "INGREDIENT_CONFLICT"
  | "INGREDIENT_VERSION_CONFLICT"
  | "INGREDIENT_NOT_FOUND"
  | "STAFF_IDENTITY_INVALID"
  | "STAFF_ACCESS_DENIED"
  | "STAFF_ACCOUNT_DISABLED"
  | "INGREDIENT_UNAVAILABLE";

export class IngredientError extends Error {
  constructor(public code: IngredientErrorCode, public status: number) {
    super(code);
    this.name = "IngredientError";
  }
}

export type IngredientFilters = {
  includeArchived?: boolean;
  page: number;
  query?: string;
  size: number;
};

type JsonObject = Record<string, unknown>;

function invalid(): never {
  throw new Error("invalid ingredient response");
}

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
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
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) invalid();
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function baseUnit(value: unknown): BaseUnit {
  if (value !== "GRAM" && value !== "MILLILITER" && value !== "EACH") invalid();
  return value;
}

function parseIngredient(value: unknown): Ingredient {
  const input = object(value);
  return {
    id: string(input.id),
    name: string(input.name),
    sku: nullableString(input.sku),
    baseUnit: baseUnit(input.baseUnit),
    reorderThreshold: nullableString(input.reorderThreshold),
    version: integer(input.version),
    archived: boolean(input.archived),
    createdAt: string(input.createdAt),
    updatedAt: string(input.updatedAt),
  };
}

function parsePage(value: unknown): IngredientPage {
  const input = object(value);
  if (!Array.isArray(input.items)) invalid();
  return {
    items: input.items.map(parseIngredient),
    page: integer(input.page),
    size: integer(input.size),
    totalItems: integer(input.totalItems),
    totalPages: integer(input.totalPages),
  };
}

function knownCode(value: unknown): IngredientErrorCode {
  if (
    value === "INGREDIENT_INVALID"
    || value === "INGREDIENT_CONFLICT"
    || value === "INGREDIENT_VERSION_CONFLICT"
    || value === "INGREDIENT_NOT_FOUND"
    || value === "STAFF_IDENTITY_INVALID"
    || value === "STAFF_ACCESS_DENIED"
    || value === "STAFF_ACCOUNT_DISABLED"
  ) return value;
  return "INGREDIENT_UNAVAILABLE";
}

function apiError(error: unknown, status: number): IngredientError {
  let code: IngredientErrorCode = "INGREDIENT_UNAVAILABLE";
  try {
    const problem = object(error);
    const properties = problem.properties === undefined ? undefined : object(problem.properties);
    code = knownCode(properties?.code ?? problem.code);
  } catch {
    // Malformed error details are reduced to a safe generic state.
  }
  return new IngredientError(code, status);
}

function client(accessToken: string) {
  return createClient<paths>({
    baseUrl: window.location.origin,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getIngredients(
  accessToken: string,
  organizationId: string,
  filters: IngredientFilters,
  signal?: AbortSignal,
): Promise<IngredientPage> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/ingredients",
    {
      params: {
        path: { organizationId },
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
  return parsePage(data);
}

export async function createIngredient(
  accessToken: string,
  organizationId: string,
  input: CreateIngredientInput,
): Promise<Ingredient> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/ingredients",
    { params: { path: { organizationId } }, body: input },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseIngredient(data);
}

export async function updateIngredient(
  accessToken: string,
  organizationId: string,
  ingredientId: string,
  input: UpdateIngredientInput,
): Promise<Ingredient> {
  const { data, error, response } = await client(accessToken).PUT(
    "/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}",
    { params: { path: { organizationId, ingredientId } }, body: input },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseIngredient(data);
}

export async function archiveIngredient(
  accessToken: string,
  organizationId: string,
  ingredientId: string,
  version: number,
): Promise<Ingredient> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}/archive",
    { params: { path: { organizationId, ingredientId } }, body: { version } },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseIngredient(data);
}
