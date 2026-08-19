import type {
  CatalogLocation,
  CatalogMenu,
  CatalogOptionChoice,
  CatalogOptionGroup,
  CatalogProduct,
  CatalogProductSummary,
  CatalogVariant,
  Money,
} from "./types";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as JsonObject;
}

function string(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value;
}

function number(value: unknown): number {
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

function invalid(): never {
  throw new Error("invalid catalog response");
}

function money(value: unknown): Money {
  const input = object(value);
  return { amountMinor: number(input.amountMinor), currency: string(input.currency) };
}

function location(value: unknown): CatalogLocation {
  const input = object(value);
  return {
    id: string(input.id),
    slug: string(input.slug),
    name: string(input.name),
    currency: string(input.currency),
  };
}

function productSummary(value: unknown): CatalogProductSummary {
  const input = object(value);
  return {
    id: string(input.id),
    slug: string(input.slug),
    name: string(input.name),
    description: string(input.description),
    category: string(input.category),
    artworkKey: string(input.artworkKey),
    startingPrice: money(input.startingPrice),
    available: boolean(input.available),
  };
}

function optionChoice(value: unknown): CatalogOptionChoice {
  const input = object(value);
  return {
    id: string(input.id),
    name: string(input.name),
    displayOrder: number(input.displayOrder),
    isDefault: boolean(input.isDefault),
    priceDelta: money(input.priceDelta),
  };
}

function optionGroup(value: unknown): CatalogOptionGroup {
  const input = object(value);
  return {
    id: string(input.id),
    name: string(input.name),
    minimumSelections: number(input.minimumSelections),
    maximumSelections: number(input.maximumSelections),
    displayOrder: number(input.displayOrder),
    choices: array(input.choices, optionChoice),
  };
}

function variant(value: unknown): CatalogVariant {
  const input = object(value);
  return {
    id: string(input.id),
    name: string(input.name),
    displayOrder: number(input.displayOrder),
    isDefault: boolean(input.isDefault),
    available: boolean(input.available),
    price: money(input.price),
    optionGroups: array(input.optionGroups, optionGroup),
  };
}

function menu(value: unknown): CatalogMenu {
  const input = object(value);
  return { location: location(input.location), products: array(input.products, productSummary) };
}

function product(value: unknown): CatalogProduct {
  const input = object(value);
  return {
    id: string(input.id),
    slug: string(input.slug),
    name: string(input.name),
    description: string(input.description),
    category: string(input.category),
    artworkKey: string(input.artworkKey),
    variants: array(input.variants, variant),
  };
}

async function get<T>(url: string, parse: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("catalog could not be loaded");
  return parse(await response.json());
}

export function getGuestMenu(signal?: AbortSignal) {
  return get("/api/v1/guest/menu", menu, signal);
}

export function getGuestProduct(productSlug: string, signal?: AbortSignal) {
  return get(`/api/v1/guest/menu/products/${encodeURIComponent(productSlug)}`, product, signal);
}
