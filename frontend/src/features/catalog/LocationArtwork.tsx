import { Store } from "lucide-react";
import type { CatalogLocation } from "./types";

export function LocationArtwork({
  location,
  priority = false,
}: {
  location: CatalogLocation;
  priority?: boolean;
}) {
  if (location.imageKey === "generic") return <div className="location-picker-placeholder flex items-center justify-center bg-muted" aria-hidden="true"><Store className="size-12 text-muted-foreground" /></div>;
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
