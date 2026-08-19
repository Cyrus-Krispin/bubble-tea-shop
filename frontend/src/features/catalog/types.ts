export type DrinkCategory = "Milk tea" | "Fruit tea" | "Tea latte";

export type DrinkTone = "moon" | "berry" | "matcha" | "taro";

export type Drink = {
  id: string;
  name: string;
  description: string;
  category: DrinkCategory;
  basePriceMinor: number;
  available: boolean;
  tone: DrinkTone;
};
