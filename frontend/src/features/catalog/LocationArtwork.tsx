import type { CatalogLocation } from "./types";

export function LocationArtwork({
  location,
  priority = false,
}: {
  location: CatalogLocation;
  priority?: boolean;
}) {
  return (
    <img
      alt=""
      className="location-picker-photo"
      decoding="async"
      height="800"
      loading={priority ? "eager" : "lazy"}
      src={`/assets/catalog/${location.imageKey}.webp`}
      width="1200"
    />
  );
}
