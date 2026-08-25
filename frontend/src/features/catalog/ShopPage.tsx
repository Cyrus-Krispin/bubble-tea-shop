import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useParams } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardFooter } from "../../components/ui/card";
import { ProblemState } from "../../components/shared";
import { useCart } from "../cart/CartContext";
import { LastOrderSuggestion } from "../orders/LastOrderSuggestion";
import { DrinkArtwork } from "./DrinkArtwork";
import { LocationPicker } from "./LocationPicker";
import { formatMoney } from "./formatMoney";
import { useGuestLocations, useGuestMenu } from "./useGuestCatalog";
import "./catalog.css";

export function ShopPage() {
  const { itemCount } = useCart();
  const { locationSlug } = useParams();
  const [category, setCategory] = useState("All");
  const locations = useGuestLocations();
  const { state, retry } = useGuestMenu(locationSlug);

  if (state.status === "loading") {
    return <CatalogStatus itemCount={itemCount} message="Loading today’s menu…" />;
  }
  if (state.status === "error") {
    return <CatalogStatus itemCount={itemCount} message="We couldn’t load the menu." retry={retry} />;
  }

  const categories = ["All", ...new Set(state.data.products.map((drink) => drink.category))];
  const drinks = category === "All"
    ? state.data.products
    : state.data.products.filter((drink) => drink.category === category);

  return (
    <div className="customer-shell">
      <a className="skip-link" href="#menu-title">Skip to menu</a>
      <CustomerHeader itemCount={itemCount} />
      <main aria-label="Guest shop" className="shop-main">
        <div className="shop-heading">
          <div>
            <p className="eyebrow">Fresh tea · made to order</p>
            <h1 id="menu-title">Drinks made your way</h1>
            <p>Choose a tea, then set the size, sweetness, ice, and toppings.</p>
          </div>
          {locations.status === "ready" ? (
            <LocationPicker locations={locations.data} selected={state.data.location} />
          ) : (
            <p className="location-picker-static">Pickup at <strong>{state.data.location.name}</strong></p>
          )}
        </div>
        <p aria-atomic="true" className="visually-hidden" role="status">Menu for {state.data.location.name}</p>
        <LastOrderSuggestion locationSlug={state.data.location.slug} products={state.data.products} />
        <div className="category-filter" aria-label="Filter drinks" role="group">
          {categories.map((option) => (
            <Button
              aria-pressed={category === option}
              className="rounded-full"
              key={option}
              onClick={() => setCategory(option)}
              size="regular"
              variant={category === option ? "default" : "outline"}
            >
              {option}
            </Button>
          ))}
        </div>
        <section
          aria-label={`${category} drinks`}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {drinks.length === 0 ? <p className="catalog-empty" role="status">No drinks are available in this category.</p> : null}
          {drinks.map((drink, index) => (
            <article className="min-w-0" key={drink.id}>
              <Card className={`group h-full gap-0 overflow-hidden py-0 transition-shadow duration-150 hover:ring-foreground/20${drink.available ? "" : " bg-muted/35"}`}>
                <DrinkArtwork
                  className={`aspect-[4/3] w-full object-cover object-[center_47%]${drink.available ? "" : " grayscale"}`}
                  drink={drink}
                  priority={index < 4}
                />
                <CardContent className="flex min-h-28 flex-col px-4 pt-4 pb-3">
                  <Badge className="mb-2 w-fit" variant="secondary">{drink.category}</Badge>
                  <h2 className="mb-1.5 text-lg leading-tight font-semibold tracking-tight">{drink.name}</h2>
                  <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{drink.description}</p>
                </CardContent>
                <CardFooter className="mt-auto min-h-16 justify-between gap-2 border-t px-4 py-2.5">
                  <strong className="text-sm leading-tight">
                    {drink.available ? `From ${formatMoney(drink.startingPrice.amountMinor, drink.startingPrice.currency)}` : "Unavailable today"}
                  </strong>
                  {drink.available ? (
                    <Button asChild className="shrink-0" size="regular" variant="secondary">
                      <Link aria-label={`Customize ${drink.name}, from ${formatMoney(drink.startingPrice.amountMinor, drink.startingPrice.currency)}`} to={`/shop/${state.data.location.slug}/drinks/${drink.slug}`}>
                        Customize <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : <span className="product-status text-sm font-semibold text-destructive">Sold out</span>}
                </CardFooter>
              </Card>
            </article>
          ))}
        </section>
      </main>
      <span hidden id="tracking-unavailable">Order tracking is not available in this preview.</span>
    </div>
  );
}

function CatalogStatus({
  itemCount,
  message,
  retry,
}: {
  itemCount: number;
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="customer-shell">
      <CustomerHeader itemCount={itemCount} />
      <main className="catalog-status" aria-live="polite">
        {retry === undefined ? <p role="status">{message}</p> : (
          <ProblemState message={message} onRetry={retry} title="Menu unavailable" />
        )}
      </main>
    </div>
  );
}
