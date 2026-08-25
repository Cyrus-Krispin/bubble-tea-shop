import { cn } from "../../lib/utils";
import type { DrinkArtworkProduct } from "./types";

export function DrinkArtwork({
  className,
  drink,
  priority = false,
}: {
  className?: string;
  drink: DrinkArtworkProduct;
  priority?: boolean;
}) {
  return (
    <img
      alt={`${drink.name} in a clear cup`}
      className={cn("drink-art", className)}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      height="1125"
      loading={priority ? "eager" : "lazy"}
      src={`/assets/catalog/${drink.artworkKey}.webp`}
      width="900"
    />
  );
}
