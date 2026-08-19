import type { Drink } from "./types";

export const demoDrinks: Drink[] = [
  {
    id: "moonlit-milk-tea",
    name: "Moonlit Milk Tea",
    description: "Creamy black tea with brown sugar pearls and a smooth finish.",
    category: "Milk tea",
    basePriceMinor: 660,
    available: true,
    tone: "moon",
  },
  {
    id: "sunberry-oolong",
    name: "Sunberry Oolong",
    description: "Bright oolong layered with strawberry, citrus, and berry notes.",
    category: "Fruit tea",
    basePriceMinor: 660,
    available: true,
    tone: "berry",
  },
  {
    id: "mossy-matcha",
    name: "Mossy Matcha",
    description: "Earthy matcha with fresh milk and a soft, balanced finish.",
    category: "Tea latte",
    basePriceMinor: 660,
    available: true,
    tone: "matcha",
  },
  {
    id: "cloudberry-taro",
    name: "Cloudberry Taro",
    description: "Silky taro milk tea with a mellow vanilla aroma.",
    category: "Milk tea",
    basePriceMinor: 690,
    available: false,
    tone: "taro",
  },
];

export function findDemoDrink(drinkId: string | undefined) {
  return demoDrinks.find((drink) => drink.id === drinkId);
}
