import type { components } from "../../api/generated";

type Schemas = components["schemas"];

export type Money = Schemas["Money"];
export type CatalogLocation = Schemas["Location"];
export type CatalogProductSummary = Schemas["ProductSummary"];
export type CatalogMenu = Schemas["Menu"];
export type CatalogOptionChoice = Schemas["OptionChoice"];
export type CatalogOptionGroup = Schemas["OptionGroup"];
export type CatalogVariant = Schemas["Variant"];
export type CatalogProduct = Schemas["Product"];

export type DrinkArtworkProduct = Pick<CatalogProductSummary, "name" | "artworkKey">;
