import createClient from "openapi-fetch";

import type { components, paths } from "../../api/generated";

type Schemas = components["schemas"];

export type MenuProductPage = Schemas["StaffMenuProductPage"];
export type MenuProductSummary = Schemas["StaffMenuProductSummary"];
export type MenuProduct = Schemas["StaffMenuProductDetail"];
export type MenuVariant = Schemas["StaffMenuVariant"];
export type MenuOffering = Schemas["StaffMenuOffering"];
export type VariantOptionChoice = Schemas["StaffVariantOptionChoice"];
export type OptionIngredientEffect = Schemas["StaffOptionIngredientEffect"];
export type OptionGroupPage = Schemas["StaffOptionGroupPage"];
export type OptionGroupSummary = Schemas["StaffOptionGroupSummary"];
export type OptionGroup = Schemas["StaffOptionGroupDetail"];
export type OptionChoice = Schemas["StaffOptionChoice"];
export type ProductInput = Schemas["ProductRequest"];
export type ProductUpdateInput = Schemas["UpdateProductRequest"];
export type VariantInput = Schemas["CreateVariantRequest"];
export type VariantUpdateInput = Schemas["UpdateVariantRequest"];
export type OfferingInput = Schemas["CreateOfferingRequest"];
export type OfferingUpdateInput = Schemas["UpdateOfferingRequest"];
export type OptionGroupInput = Schemas["GroupRequest"];
export type OptionGroupUpdateInput = Schemas["UpdateGroupRequest"];
export type OptionChoiceInput = Schemas["ChoiceRequest"];
export type OptionChoiceUpdateInput = Schemas["UpdateChoiceRequest"];
export type ChoiceConfigurationInput = Schemas["ConfigurationRequest"];

export type MenuErrorCode =
  | "MENU_INVALID"
  | "MENU_CONFLICT"
  | "MENU_VERSION_CONFLICT"
  | "MENU_STATE_CONFLICT"
  | "MENU_NOT_FOUND"
  | "OPTION_INVALID"
  | "OPTION_CONFLICT"
  | "OPTION_VERSION_CONFLICT"
  | "OPTION_STATE_CONFLICT"
  | "OPTION_NOT_FOUND"
  | "STAFF_IDENTITY_INVALID"
  | "STAFF_ACCESS_DENIED"
  | "STAFF_ACCOUNT_DISABLED"
  | "CATALOG_UNAVAILABLE";

export class MenuError extends Error {
  constructor(
    public code: MenuErrorCode,
    public status: number,
  ) {
    super(code);
    this.name = "MenuError";
  }
}

export type PageFilters = {
  includeArchived?: boolean;
  page: number;
  query?: string;
  size: number;
};

type JsonObject = Record<string, unknown>;

function invalid(): never {
  throw new Error("invalid menu management response");
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

function productSummary(value: unknown): MenuProductSummary {
  const input = object(value);
  return {
    id: string(input.id),
    publicSlug: string(input.publicSlug),
    name: string(input.name),
    description: nullableString(input.description),
    category: nullableString(input.category),
    artworkKey: nullableString(input.artworkKey),
    imageUrl: nullableString(input.imageUrl),
    displayOrder: integer(input.displayOrder),
    version: integer(input.version),
    archived: boolean(input.archived),
    activeVariantCount: integer(input.activeVariantCount),
  };
}

function ingredientEffect(value: unknown): OptionIngredientEffect {
  const input = object(value);
  return {
    ingredientId: string(input.ingredientId),
    ingredientName: string(input.ingredientName),
    baseUnit: string(input.baseUnit),
    quantityDelta: string(input.quantityDelta),
  };
}

function configuredChoice(value: unknown): VariantOptionChoice {
  const input = object(value);
  return {
    id: string(input.id),
    choiceId: string(input.choiceId),
    choiceName: string(input.choiceName),
    groupId: string(input.groupId),
    groupName: string(input.groupName),
    priceDeltaMinor: signedInteger(input.priceDeltaMinor),
    enabled: boolean(input.enabled),
    version: integer(input.version),
    ingredientEffects: array(input.ingredientEffects, ingredientEffect),
  };
}

function variant(value: unknown): MenuVariant {
  const input = object(value);
  return {
    id: string(input.id),
    name: string(input.name),
    displayOrder: integer(input.displayOrder),
    defaultVariant: boolean(input.defaultVariant),
    version: integer(input.version),
    archived: boolean(input.archived),
    createdAt: string(input.createdAt),
    updatedAt: string(input.updatedAt),
    choices: array(input.choices, configuredChoice),
  };
}

function offering(value: unknown): MenuOffering {
  const input = object(value);
  return {
    id: string(input.id),
    locationId: string(input.locationId),
    locationName: string(input.locationName),
    variantId: string(input.variantId),
    variantName: string(input.variantName),
    recipeVersionId: string(input.recipeVersionId),
    recipeName: string(input.recipeName),
    recipeVersionNumber: integer(input.recipeVersionNumber),
    priceMinor: integer(input.priceMinor),
    currencyCode: string(input.currencyCode),
    available: boolean(input.available),
    version: integer(input.version),
    createdAt: string(input.createdAt),
    updatedAt: string(input.updatedAt),
  };
}

function product(value: unknown): MenuProduct {
  const input = object(value);
  return {
    id: string(input.id),
    publicSlug: string(input.publicSlug),
    name: string(input.name),
    description: nullableString(input.description),
    category: nullableString(input.category),
    artworkKey: nullableString(input.artworkKey),
    imageUrl: nullableString(input.imageUrl),
    displayOrder: integer(input.displayOrder),
    version: integer(input.version),
    archived: boolean(input.archived),
    createdAt: string(input.createdAt),
    updatedAt: string(input.updatedAt),
    variants: array(input.variants, variant),
    offerings: array(input.offerings, offering),
  };
}

function choice(value: unknown): OptionChoice {
  const input = object(value);
  return {
    id: string(input.id),
    name: string(input.name),
    displayOrder: integer(input.displayOrder),
    defaultChoice: boolean(input.defaultChoice),
    version: integer(input.version),
    archived: boolean(input.archived),
    createdAt: string(input.createdAt),
    updatedAt: string(input.updatedAt),
  };
}

function groupSummary(value: unknown): OptionGroupSummary {
  const input = object(value);
  return {
    id: string(input.id),
    name: string(input.name),
    minimumSelections: integer(input.minimumSelections),
    maximumSelections: integer(input.maximumSelections),
    displayOrder: integer(input.displayOrder),
    version: integer(input.version),
    archived: boolean(input.archived),
    activeChoiceCount: integer(input.activeChoiceCount),
  };
}

function group(value: unknown): OptionGroup {
  const input = object(value);
  return {
    id: string(input.id),
    name: string(input.name),
    minimumSelections: integer(input.minimumSelections),
    maximumSelections: integer(input.maximumSelections),
    displayOrder: integer(input.displayOrder),
    version: integer(input.version),
    archived: boolean(input.archived),
    createdAt: string(input.createdAt),
    updatedAt: string(input.updatedAt),
    choices: array(input.choices, choice),
  };
}

function page<T>(value: unknown, parse: (item: unknown) => T) {
  const input = object(value);
  return {
    items: array(input.items, parse),
    page: integer(input.page),
    size: integer(input.size),
    totalItems: integer(input.totalItems),
    totalPages: integer(input.totalPages),
  };
}

function knownCode(value: unknown): MenuErrorCode {
  const codes: readonly MenuErrorCode[] = [
    "MENU_INVALID",
    "MENU_CONFLICT",
    "MENU_VERSION_CONFLICT",
    "MENU_STATE_CONFLICT",
    "MENU_NOT_FOUND",
    "OPTION_INVALID",
    "OPTION_CONFLICT",
    "OPTION_VERSION_CONFLICT",
    "OPTION_STATE_CONFLICT",
    "OPTION_NOT_FOUND",
    "STAFF_IDENTITY_INVALID",
    "STAFF_ACCESS_DENIED",
    "STAFF_ACCOUNT_DISABLED",
  ];
  return typeof value === "string" && codes.includes(value as MenuErrorCode)
    ? (value as MenuErrorCode)
    : "CATALOG_UNAVAILABLE";
}

function apiError(error: unknown, status: number): MenuError {
  let code: MenuErrorCode = "CATALOG_UNAVAILABLE";
  try {
    const problem = object(error);
    const properties =
      problem.properties === undefined ? undefined : object(problem.properties);
    code = knownCode(properties?.code ?? problem.code);
  } catch {
    // Malformed problem details are reduced to a safe generic state.
  }
  return new MenuError(code, status);
}

function client(accessToken: string) {
  return createClient<paths>({
    baseUrl: window.location.origin,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

function filters(input: PageFilters) {
  return {
    page: input.page,
    size: input.size,
    query: input.query,
    includeArchived: input.includeArchived ?? false,
  };
}

export async function getMenuProducts(
  accessToken: string,
  organizationId: string,
  input: PageFilters,
  signal?: AbortSignal,
): Promise<MenuProductPage> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/menu-products",
    { params: { path: { organizationId }, query: filters(input) }, signal },
  );
  if (data === undefined) throw apiError(error, response.status);
  return page(data, productSummary);
}

export async function getMenuProduct(
  accessToken: string,
  organizationId: string,
  productId: string,
  signal?: AbortSignal,
): Promise<MenuProduct> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}",
    { params: { path: { organizationId, productId } }, signal },
  );
  if (data === undefined) throw apiError(error, response.status);
  return product(data);
}

export async function createMenuProduct(
  accessToken: string,
  organizationId: string,
  body: ProductInput,
): Promise<MenuProduct> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/menu-products",
    { params: { path: { organizationId } }, body },
  );
  if (data === undefined) throw apiError(error, response.status);
  return product(data);
}

export async function updateMenuProduct(
  accessToken: string,
  organizationId: string,
  productId: string,
  body: ProductUpdateInput,
): Promise<MenuProduct> {
  const { data, error, response } = await client(accessToken).PUT(
    "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}",
    { params: { path: { organizationId, productId } }, body },
  );
  if (data === undefined) throw apiError(error, response.status);
  return product(data);
}

export async function archiveMenuProduct(
  accessToken: string,
  organizationId: string,
  productId: string,
  version: number,
): Promise<MenuProduct> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/archive",
    { params: { path: { organizationId, productId } }, body: { version } },
  );
  if (data === undefined) throw apiError(error, response.status);
  return product(data);
}

export async function createMenuVariant(
  accessToken: string,
  organizationId: string,
  productId: string,
  body: VariantInput,
): Promise<MenuProduct> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants",
    { params: { path: { organizationId, productId } }, body },
  );
  if (data === undefined) throw apiError(error, response.status);
  return product(data);
}

export async function updateMenuVariant(
  accessToken: string,
  organizationId: string,
  productId: string,
  variantId: string,
  body: VariantUpdateInput,
): Promise<MenuProduct> {
  const { data, error, response } = await client(accessToken).PUT(
    "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}",
    { params: { path: { organizationId, productId, variantId } }, body },
  );
  if (data === undefined) throw apiError(error, response.status);
  return product(data);
}

export async function archiveMenuVariant(
  accessToken: string,
  organizationId: string,
  productId: string,
  variantId: string,
  version: number,
): Promise<MenuProduct> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/archive",
    {
      params: { path: { organizationId, productId, variantId } },
      body: { version },
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return product(data);
}

export async function getMenuOfferings(
  accessToken: string,
  organizationId: string,
  locationId: string,
  variantId?: string,
  signal?: AbortSignal,
): Promise<readonly MenuOffering[]> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings",
    {
      params: { path: { organizationId, locationId }, query: { variantId } },
      signal,
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return array(data, offering);
}

export async function createMenuOffering(
  accessToken: string,
  organizationId: string,
  locationId: string,
  body: OfferingInput,
): Promise<MenuOffering> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings",
    { params: { path: { organizationId, locationId } }, body },
  );
  if (data === undefined) throw apiError(error, response.status);
  return offering(data);
}

export async function updateMenuOffering(
  accessToken: string,
  organizationId: string,
  locationId: string,
  offeringId: string,
  body: OfferingUpdateInput,
): Promise<MenuOffering> {
  const { data, error, response } = await client(accessToken).PUT(
    "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings/{offeringId}",
    { params: { path: { organizationId, locationId, offeringId } }, body },
  );
  if (data === undefined) throw apiError(error, response.status);
  return offering(data);
}

export async function getOptionGroups(
  accessToken: string,
  organizationId: string,
  input: PageFilters,
  signal?: AbortSignal,
): Promise<OptionGroupPage> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/option-groups",
    { params: { path: { organizationId }, query: filters(input) }, signal },
  );
  if (data === undefined) throw apiError(error, response.status);
  return page(data, groupSummary);
}

export async function getOptionGroup(
  accessToken: string,
  organizationId: string,
  groupId: string,
  includeArchivedChoices = false,
  signal?: AbortSignal,
): Promise<OptionGroup> {
  const { data, error, response } = await client(accessToken).GET(
    "/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}",
    {
      params: {
        path: { organizationId, groupId },
        query: { includeArchivedChoices },
      },
      signal,
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return group(data);
}

export async function createOptionGroup(
  accessToken: string,
  organizationId: string,
  body: OptionGroupInput,
): Promise<OptionGroup> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/option-groups",
    { params: { path: { organizationId } }, body },
  );
  if (data === undefined) throw apiError(error, response.status);
  return group(data);
}

export async function updateOptionGroup(
  accessToken: string,
  organizationId: string,
  groupId: string,
  body: OptionGroupUpdateInput,
): Promise<OptionGroup> {
  const { data, error, response } = await client(accessToken).PUT(
    "/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}",
    { params: { path: { organizationId, groupId } }, body },
  );
  if (data === undefined) throw apiError(error, response.status);
  return group(data);
}

export async function archiveOptionGroup(
  accessToken: string,
  organizationId: string,
  groupId: string,
  version: number,
): Promise<OptionGroup> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/archive",
    { params: { path: { organizationId, groupId } }, body: { version } },
  );
  if (data === undefined) throw apiError(error, response.status);
  return group(data);
}

export async function createOptionChoice(
  accessToken: string,
  organizationId: string,
  groupId: string,
  body: OptionChoiceInput,
): Promise<OptionGroup> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/choices",
    { params: { path: { organizationId, groupId } }, body },
  );
  if (data === undefined) throw apiError(error, response.status);
  return group(data);
}

export async function updateOptionChoice(
  accessToken: string,
  organizationId: string,
  groupId: string,
  choiceId: string,
  body: OptionChoiceUpdateInput,
): Promise<OptionGroup> {
  const { data, error, response } = await client(accessToken).PUT(
    "/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/choices/{choiceId}",
    { params: { path: { organizationId, groupId, choiceId } }, body },
  );
  if (data === undefined) throw apiError(error, response.status);
  return group(data);
}

export async function archiveOptionChoice(
  accessToken: string,
  organizationId: string,
  groupId: string,
  choiceId: string,
  version: number,
): Promise<OptionGroup> {
  const { data, error, response } = await client(accessToken).POST(
    "/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/choices/{choiceId}/archive",
    {
      params: { path: { organizationId, groupId, choiceId } },
      body: { version },
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return group(data);
}

export async function configureVariantOptionChoice(
  accessToken: string,
  organizationId: string,
  productId: string,
  variantId: string,
  choiceId: string,
  body: ChoiceConfigurationInput,
): Promise<VariantOptionChoice> {
  const { data, error, response } = await client(accessToken).PUT(
    "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}",
    {
      params: { path: { organizationId, productId, variantId, choiceId } },
      body,
    },
  );
  if (data === undefined) throw apiError(error, response.status);
  return configuredChoice(data);
}
