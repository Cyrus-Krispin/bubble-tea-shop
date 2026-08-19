import type { DrinkArtworkProduct } from "./types";

const artworkKeys = new Set(["moon", "berry", "matcha", "taro"]);

export function DrinkArtwork({ drink }: { drink: DrinkArtworkProduct }) {
  const artworkKey = artworkKeys.has(drink.artworkKey) ? drink.artworkKey : "moon";
  return (
    <svg
      aria-label={`Illustration of ${drink.name}`}
      className={`drink-art drink-art--${artworkKey}`}
      role="img"
      viewBox="0 0 240 280"
    >
      <path className="art-backdrop" d="M30 122C43 52 184 28 212 111c27 82-48 139-113 137-68-2-83-65-69-126Z" />
      <path className="art-leaf" d="M37 88c-16-14-14-33-12-41 18 2 31 13 35 29-7 1-15 5-23 12Zm170 34c4-22 18-32 29-35 2 17-5 31-22 39Z" />
      <path className="cup-lid" d="M72 79h99l-6 17H78Z" />
      <path className="cup-body" d="m80 93 10 138c1 13 11 21 24 21h17c13 0 23-8 24-21l10-138Z" />
      <path className="cup-shine" d="M97 111c5 54 7 92 9 113" />
      <path className="straw" d="m130 91 13-69 14 3-13 68" />
      <g className="pearls">
        <circle cx="107" cy="218" r="8" /><circle cx="127" cy="231" r="8" />
        <circle cx="145" cy="213" r="8" /><circle cx="117" cy="204" r="7" />
      </g>
      <path className="art-spark" d="m48 183 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
    </svg>
  );
}
