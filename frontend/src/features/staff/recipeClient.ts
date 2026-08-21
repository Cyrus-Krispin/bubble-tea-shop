import createClient from "openapi-fetch";

import type { components, paths } from "../../api/generated";

type Schemas = components["schemas"];

export type Recipe = Schemas["RecipeDetail"];
export type RecipeSummary = Schemas["RecipeSummary"];
export type RecipePage = Schemas["RecipePage"];
export type RecipeVersion = Schemas["RecipeVersion"];
export type RecipeComponent = Schemas["RecipeComponent"];
export type CreateRecipeInput = Schemas["CreateRecipeRequest"];
export type UpdateRecipeInput = Schemas["UpdateRecipeRequest"];
export type UpdateRecipeDraftInput = Schemas["UpdateDraftRequest"];
export type RecipeStatus = RecipeVersion["status"];

export type RecipeErrorCode =
  | "RECIPE_INVALID"
  | "RECIPE_CONFLICT"
  | "RECIPE_VERSION_CONFLICT"
  | "RECIPE_STATE_CONFLICT"
  | "RECIPE_NOT_FOUND"
  | "STAFF_IDENTITY_INVALID"
  | "STAFF_ACCESS_DENIED"
  | "STAFF_ACCOUNT_DISABLED"
  | "RECIPE_UNAVAILABLE";

export class RecipeError extends Error {
  constructor(public code: RecipeErrorCode, public status: number) {
    super(code);
    this.name = "RecipeError";
  }
}

export type RecipeFilters = {
  includeArchived?: boolean;
  page: number;
  query?: string;
  size: number;
};

type JsonObject = Record<string, unknown>;

function invalid(): never {
  throw new Error("invalid recipe response");
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

function recipeStatus(value: unknown): RecipeStatus {
  if (value !== "DRAFT" && value !== "PUBLISHED" && value !== "RETIRED") invalid();
  return value;
}

function baseUnit(value: unknown): RecipeComponent["baseUnit"] {
  if (value !== "GRAM" && value !== "MILLILITER" && value !== "EACH") invalid();
  return value;
}

function parseComponent(value: unknown): RecipeComponent {
  const input = object(value);
  return {
    ingredientId: string(input.ingredientId),
    ingredientName: string(input.ingredientName),
    baseUnit: baseUnit(input.baseUnit),
    quantity: string(input.quantity),
  };
}

function parseVersion(value: unknown): RecipeVersion {
  const input = object(value);
  if (!Array.isArray(input.components)) invalid();
  return {
    id: string(input.id),
    versionNumber: integer(input.versionNumber),
    status: recipeStatus(input.status),
    version: integer(input.version),
    createdAt: string(input.createdAt),
    publishedAt: nullableString(input.publishedAt),
    components: input.components.map(parseComponent),
  };
}

function parseRecipe(value: unknown): Recipe {
  const input = object(value);
  if (!Array.isArray(input.versions)) invalid();
  return {
    id: string(input.id),
    name: string(input.name),
    description: nullableString(input.description),
    version: integer(input.version),
    archived: boolean(input.archived),
    createdAt: string(input.createdAt),
    updatedAt: string(input.updatedAt),
    versions: input.versions.map(parseVersion),
  };
}

function parseSummary(value: unknown): RecipeSummary {
  const input = object(value);
  return {
    id: string(input.id),
    name: string(input.name),
    description: nullableString(input.description),
    version: integer(input.version),
    archived: boolean(input.archived),
    latestVersionNumber: integer(input.latestVersionNumber),
    latestStatus: recipeStatus(input.latestStatus),
  };
}

function parsePage(value: unknown): RecipePage {
  const input = object(value);
  if (!Array.isArray(input.items)) invalid();
  return {
    items: input.items.map(parseSummary),
    page: integer(input.page),
    size: integer(input.size),
    totalItems: integer(input.totalItems),
    totalPages: integer(input.totalPages),
  };
}

function knownCode(value: unknown): RecipeErrorCode {
  if (
    value === "RECIPE_INVALID"
    || value === "RECIPE_CONFLICT"
    || value === "RECIPE_VERSION_CONFLICT"
    || value === "RECIPE_STATE_CONFLICT"
    || value === "RECIPE_NOT_FOUND"
    || value === "STAFF_IDENTITY_INVALID"
    || value === "STAFF_ACCESS_DENIED"
    || value === "STAFF_ACCOUNT_DISABLED"
  ) return value;
  return "RECIPE_UNAVAILABLE";
}

function apiError(error: unknown, status: number): RecipeError {
  let code: RecipeErrorCode = "RECIPE_UNAVAILABLE";
  try {
    const problem = object(error);
    const properties = problem.properties === undefined ? undefined : object(problem.properties);
    code = knownCode(properties?.code ?? problem.code);
  } catch {
    // Malformed problem details are reduced to a safe generic state.
  }
  return new RecipeError(code, status);
}

function client(accessToken: string) {
  return createClient<paths>({
    baseUrl: window.location.origin,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getRecipes(
  accessToken: string,
  organizationId: string,
  filters: RecipeFilters,
  signal?: AbortSignal,
): Promise<RecipePage> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/recipes",
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

export async function createRecipe(
  accessToken: string,
  organizationId: string,
  input: CreateRecipeInput,
): Promise<Recipe> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/recipes",
    { params: { path: { organizationId } }, body: input },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseRecipe(data);
}

export async function getRecipe(
  accessToken: string,
  organizationId: string,
  recipeId: string,
  signal?: AbortSignal,
): Promise<Recipe> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}",
    { params: { path: { organizationId, recipeId } }, signal },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseRecipe(data);
}

export async function updateRecipe(
  accessToken: string,
  organizationId: string,
  recipeId: string,
  input: UpdateRecipeInput,
): Promise<Recipe> {
  const { data, error, response } = await client(accessToken).PUT(
    "/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}",
    { params: { path: { organizationId, recipeId } }, body: input },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseRecipe(data);
}

export async function archiveRecipe(
  accessToken: string,
  organizationId: string,
  recipeId: string,
  version: number,
): Promise<Recipe> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/archive",
    { params: { path: { organizationId, recipeId } }, body: { version } },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseRecipe(data);
}

export async function createRecipeVersion(
  accessToken: string,
  organizationId: string,
  recipeId: string,
  version: number,
  sourceVersionId: string | null = null,
): Promise<RecipeVersion> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions",
    {
      params: { path: { organizationId, recipeId } },
      body: { version, sourceVersionId },
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseVersion(data);
}

export async function replaceRecipeDraft(
  accessToken: string,
  organizationId: string,
  recipeId: string,
  versionId: string,
  input: UpdateRecipeDraftInput,
): Promise<RecipeVersion> {
  const { data, error, response } = await client(accessToken).PUT(
    "/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft",
    { params: { path: { organizationId, recipeId, versionId } }, body: input },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseVersion(data);
}

export async function publishRecipeVersion(
  accessToken: string,
  organizationId: string,
  recipeId: string,
  versionId: string,
  version: number,
): Promise<RecipeVersion> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/publish",
    { params: { path: { organizationId, recipeId, versionId } }, body: { version } },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseVersion(data);
}

export async function retireRecipeVersion(
  accessToken: string,
  organizationId: string,
  recipeId: string,
  versionId: string,
  version: number,
): Promise<RecipeVersion> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/retire",
    { params: { path: { organizationId, recipeId, versionId } }, body: { version } },
  );
  if (data === undefined) throw apiError(error, response.status);
  return parseVersion(data);
}
