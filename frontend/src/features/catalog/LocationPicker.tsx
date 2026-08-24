import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import type { CatalogLocation } from "./types";
import { LocationArtwork } from "./LocationArtwork";

export function LocationPicker({
  locations,
  selected,
}: {
  locations: CatalogLocation[];
  selected: CatalogLocation;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  return (
    <div className="location-picker" ref={root}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={`Pickup at ${selected.name}`}
        className="location-picker-trigger"
        onClick={() => setOpen((current) => !current)}
        ref={trigger}
        type="button"
      >
        <LocationArtwork location={selected} priority />
        <span><small>Pickup at</small><strong>{selected.name}</strong></span>
        <span aria-hidden="true" className="location-picker-chevron">⌄</span>
      </button>
      {open ? (
        <div className="location-picker-panel" id={panelId}>
          <p>Choose a pickup shop</p>
          <ul>
            {locations.map((location) => {
              const current = location.id === selected.id;
              return (
                <li key={location.id}>
                  <Link
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    to={`/shop/${location.slug}`}
                  >
                    <LocationArtwork location={location} />
                    <span><strong>{location.name}</strong><small>{current ? "Current shop" : "View menu"}</small></span>
                    <span aria-hidden="true" className="location-picker-check">{current ? "✓" : "→"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
