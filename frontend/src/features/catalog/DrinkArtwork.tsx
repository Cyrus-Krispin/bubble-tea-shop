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
      <rect className="art-backdrop" height="216" rx="24" transform="rotate(-3 120 145)" width="212" x="14" y="37" />
      <path className="art-signal" d="m190 28 28 5m-31 8 22 4" />
      <path className="cup-lid" d="M72 79h99l-6 17H78Z" />
      <path className="cup-body" d="m80 93 10 138c1 13 11 21 24 21h17c13 0 23-8 24-21l10-138Z" />
      <path className="cup-shine" d="M97 111c5 54 7 92 9 113" />
      <path className="straw" d="m130 91 13-69 14 3-13 68" />
      <g className="pearls">
        <circle cx="107" cy="218" r="8" /><circle cx="127" cy="231" r="8" />
        <circle cx="145" cy="213" r="8" /><circle cx="117" cy="204" r="7" />
      </g>
    </svg>
  );
}
