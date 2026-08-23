import { useState } from "react";
import { Link } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { ProblemState } from "../../components/ui";
import { useCart } from "../cart/CartContext";
import { DrinkArtwork } from "./DrinkArtwork";
import { formatMoney } from "./formatMoney";
import { useGuestMenu } from "./useGuestCatalog";
import "./catalog.css";

export function ShopPage() {
  const { itemCount } = useCart();
  const [category, setCategory] = useState("All");
  const { state, retry } = useGuestMenu();

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
          <p className="location-note"><strong>{state.data.location.name}</strong> · Order online and pay cash at pickup.</p>
        </div>
        <div className="category-filter" aria-label="Filter drinks" role="group">
          {categories.map((option) => (
            <button
              aria-pressed={category === option}
              key={option}
              onClick={() => setCategory(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
        <section aria-label={`${category} drinks`} className="product-grid">
          {drinks.length === 0 ? <p className="catalog-empty" role="status">No drinks are available in this category.</p> : null}
          {drinks.map((drink) => (
            <article className={`product-card${drink.available ? "" : " product-card--unavailable"}`} key={drink.id}>
              <DrinkArtwork drink={drink} />
              <div className="product-copy">
                <p className="product-category">{drink.category}</p>
                <h2>{drink.name}</h2>
                <p>{drink.description}</p>
              </div>
              <div className="product-footer">
                <strong>{drink.available ? `From ${formatMoney(drink.startingPrice.amountMinor, drink.startingPrice.currency)}` : "Unavailable today"}</strong>
                {drink.available ? (
                  <Link aria-label={`Customize ${drink.name}, from ${formatMoney(drink.startingPrice.amountMinor, drink.startingPrice.currency)}`} to={`/shop/drinks/${drink.slug}`}>
                    Customize <span aria-hidden="true">→</span>
                  </Link>
                ) : <span className="product-status">Sold out</span>}
              </div>
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
