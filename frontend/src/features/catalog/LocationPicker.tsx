import { useState } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { Link } from "react-router";

import { Button } from "../../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
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

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button aria-label={`Pickup at ${selected.name}`} className="h-16 w-full justify-start gap-3 px-2" variant="outline">
          <LocationArtwork location={selected} priority />
          <span className="grid min-w-0 flex-1 text-left"><small className="text-xs text-muted-foreground">Pickup at</small><strong className="truncate">{selected.name}</strong></span>
          <ChevronDown aria-hidden="true" className="text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="location-picker-panel w-[var(--radix-popover-trigger-width)] min-w-72 p-2">
          <p className="px-2 py-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Choose a pickup shop</p>
          <ul className="grid list-none gap-1 p-0">
            {locations.map((location) => {
              const current = location.id === selected.id;
              return (
                <li key={location.id}>
                  <Link className="flex min-h-16 items-center gap-3 rounded-lg px-2 text-foreground no-underline hover:bg-muted"
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    to={`/shop/${location.slug}`}
                  >
                    <LocationArtwork location={location} />
                    <span className="grid min-w-0 flex-1"><strong className="truncate">{location.name}</strong><small className="text-xs text-muted-foreground">{current ? "Current shop" : "View menu"}</small></span>
                    {current ? <Check aria-hidden="true" className="size-4 text-primary" /> : <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />}
                  </Link>
                </li>
              );
            })}
          </ul>
      </PopoverContent>
    </Popover>
  );
}
