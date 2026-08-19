import type { Drink } from "./types";

export const sizeOptions = [
  { id: "small", label: "Small", priceDeltaMinor: -50 },
  { id: "medium", label: "Medium", priceDeltaMinor: 0 },
  { id: "large", label: "Large", priceDeltaMinor: 80 },
] as const;

export const sweetnessOptions = ["0%", "25%", "50%", "75%", "100%"] as const;
export const iceOptions = ["No ice", "Less ice", "Regular ice", "Extra ice"] as const;

export const toppingOptions = [
  { id: "pearls", label: "Pearls", priceDeltaMinor: 60 },
  { id: "grass-jelly", label: "Grass jelly", priceDeltaMinor: 60 },
  { id: "aloe", label: "Aloe", priceDeltaMinor: 60 },
] as const;

export type DrinkConfiguration = {
  size: (typeof sizeOptions)[number]["id"];
  sweetness: (typeof sweetnessOptions)[number];
  ice: (typeof iceOptions)[number];
  toppingIds: Array<(typeof toppingOptions)[number]["id"]>;
};

export const defaultConfiguration: DrinkConfiguration = {
  size: "medium",
  sweetness: "50%",
  ice: "Less ice",
  toppingIds: [],
};

export function calculatePreviewTotal(drink: Drink, configuration: DrinkConfiguration) {
  const sizePrice = sizeOptions.find((option) => option.id === configuration.size)?.priceDeltaMinor ?? 0;
  const toppingsPrice = configuration.toppingIds.reduce((total, toppingId) => (
    total + (toppingOptions.find((option) => option.id === toppingId)?.priceDeltaMinor ?? 0)
  ), 0);

  return drink.basePriceMinor + sizePrice + toppingsPrice;
}
