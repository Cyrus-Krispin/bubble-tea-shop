import type { CatalogMenu, CatalogProduct } from "../features/catalog/types";

export const catalogProduct: CatalogProduct = {
  id: "30000000-0000-0000-0000-000000000001",
  slug: "moonlit-milk-tea",
  name: "Moonlit Milk Tea",
  description: "Creamy black tea with brown sugar pearls and a smooth finish.",
  category: "Milk tea",
  artworkKey: "moon",
  variants: [
    {
      id: "small",
      name: "Small",
      displayOrder: 0,
      isDefault: false,
      available: true,
      price: { amountMinor: 610, currency: "SGD" },
      optionGroups: [],
    },
    {
      id: "medium",
      name: "Medium",
      displayOrder: 1,
      isDefault: true,
      available: true,
      price: { amountMinor: 660, currency: "SGD" },
      optionGroups: [
        {
          id: "sweetness",
          name: "Sweetness",
          minimumSelections: 1,
          maximumSelections: 1,
          displayOrder: 0,
          choices: [
            { id: "sweet-0", name: "0%", displayOrder: 0, isDefault: false, priceDelta: { amountMinor: 0, currency: "SGD" } },
            { id: "sweet-50", name: "50%", displayOrder: 1, isDefault: true, priceDelta: { amountMinor: 0, currency: "SGD" } },
          ],
        },
        {
          id: "ice",
          name: "Ice",
          minimumSelections: 1,
          maximumSelections: 1,
          displayOrder: 1,
          choices: [
            { id: "less-ice", name: "Less ice", displayOrder: 0, isDefault: true, priceDelta: { amountMinor: 0, currency: "SGD" } },
          ],
        },
        {
          id: "toppings",
          name: "Toppings",
          minimumSelections: 0,
          maximumSelections: 3,
          displayOrder: 2,
          choices: [
            { id: "pearls", name: "Pearls", displayOrder: 0, isDefault: false, priceDelta: { amountMinor: 60, currency: "SGD" } },
            { id: "aloe", name: "Aloe", displayOrder: 1, isDefault: false, priceDelta: { amountMinor: 60, currency: "SGD" } },
          ],
        },
      ],
    },
    {
      id: "large",
      name: "Large",
      displayOrder: 2,
      isDefault: false,
      available: true,
      price: { amountMinor: 740, currency: "SGD" },
      optionGroups: [],
    },
  ],
};

export const catalogMenu: CatalogMenu = {
  location: {
    id: "20000000-0000-0000-0000-000000000001",
    slug: "orchard-central",
    name: "Orchard Central",
    currency: "SGD",
  },
  products: [
    {
      id: catalogProduct.id,
      slug: catalogProduct.slug,
      name: catalogProduct.name,
      description: catalogProduct.description,
      category: catalogProduct.category,
      artworkKey: catalogProduct.artworkKey,
      startingPrice: { amountMinor: 610, currency: "SGD" },
      available: true,
    },
    {
      id: "30000000-0000-0000-0000-000000000002",
      slug: "sunberry-oolong",
      name: "Sunberry Oolong",
      description: "Bright oolong layered with strawberry, citrus, and berry notes.",
      category: "Fruit tea",
      artworkKey: "berry",
      startingPrice: { amountMinor: 610, currency: "SGD" },
      available: true,
    },
    {
      id: "30000000-0000-0000-0000-000000000004",
      slug: "cloudberry-taro",
      name: "Cloudberry Taro",
      description: "Silky taro milk tea with a mellow vanilla aroma.",
      category: "Milk tea",
      artworkKey: "taro",
      startingPrice: { amountMinor: 640, currency: "SGD" },
      available: false,
    },
  ],
};
