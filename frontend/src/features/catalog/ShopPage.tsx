import { useState } from "react";
import { Link } from "react-router";

import { useCart } from "../cart/CartContext";
import { CustomerHeader } from "./CustomerHeader";
import { demoDrinks } from "./demoCatalog";
import { DrinkArtwork } from "./DrinkArtwork";
import { formatMoney } from "./formatMoney";
import type { DrinkCategory } from "./types";
import "./catalog.css";

const categories = ["All", "Milk tea", "Fruit tea", "Tea latte"] as const;

export function ShopPage() {
  const { itemCount } = useCart();
  const [category, setCategory] = useState<"All" | DrinkCategory>("All");
  const drinks = category === "All" ? demoDrinks : demoDrinks.filter((drink) => drink.category === category);

  return (
    <div className="customer-shell">
      <a className="skip-link" href="#menu-title">Skip to menu</a>
      <CustomerHeader itemCount={itemCount} />
      <main aria-label="Guest shop" className="shop-main">
        <div className="shop-heading">
          <div>
            <p className="eyebrow">Made fresh for you</p>
            <h1 id="menu-title">Choose your brew</h1>
            <p>Small-batch tea, bright ingredients, and plenty of room to make it yours.</p>
          </div>
          <p className="demo-note"><strong>Preview menu</strong> · Checkout opens when live ordering is connected.</p>
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
          {drinks.map((drink) => (
            <article className={`product-card${drink.available ? "" : " product-card--unavailable"}`} key={drink.id}>
              <DrinkArtwork drink={drink} />
              <div className="product-copy">
                <p className="product-category">{drink.category}</p>
                <h2>{drink.name}</h2>
                <p>{drink.description}</p>
              </div>
              <div className="product-footer">
                <strong>{drink.available ? `From ${formatMoney(drink.basePriceMinor)}` : "Unavailable today"}</strong>
                {drink.available ? (
                  <Link aria-label={`Customize ${drink.name}, from ${formatMoney(drink.basePriceMinor)}`} to={`/shop/drinks/${drink.id}`}>
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
