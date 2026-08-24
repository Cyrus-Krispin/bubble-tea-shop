import type { DrinkArtworkProduct } from "./types";

export function DrinkArtwork({
  drink,
  priority = false,
}: {
  drink: DrinkArtworkProduct;
  priority?: boolean;
}) {
  return (
    <img
      alt={`${drink.name} in a clear cup`}
      className="drink-art"
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      height="1125"
      loading={priority ? "eager" : "lazy"}
      src={`/assets/catalog/${drink.artworkKey}.webp`}
      width="900"
    />
  );
}
