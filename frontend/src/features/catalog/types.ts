export type Money = {
  amountMinor: number;
  currency: string;
};

export type CatalogLocation = {
  id: string;
  slug: string;
  name: string;
  currency: string;
};

export type CatalogProductSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  artworkKey: string;
  startingPrice: Money;
  available: boolean;
};

export type CatalogMenu = {
  location: CatalogLocation;
  products: CatalogProductSummary[];
};

export type CatalogOptionChoice = {
  id: string;
  name: string;
  displayOrder: number;
  isDefault: boolean;
  priceDelta: Money;
};

export type CatalogOptionGroup = {
  id: string;
  name: string;
  minimumSelections: number;
  maximumSelections: number;
  displayOrder: number;
  choices: CatalogOptionChoice[];
};

export type CatalogVariant = {
  id: string;
  name: string;
  displayOrder: number;
  isDefault: boolean;
  available: boolean;
  price: Money;
  optionGroups: CatalogOptionGroup[];
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  artworkKey: string;
  variants: CatalogVariant[];
};

export type DrinkArtworkProduct = Pick<CatalogProductSummary, "name" | "artworkKey">;
