import { Link } from "react-router";

import { CustomerHeader } from "../catalog/CustomerHeader";
import { formatMoney } from "../catalog/formatMoney";
import { toppingOptions, type DrinkConfiguration } from "../catalog/pricing";
import { useCart } from "./CartContext";
import "./cart.css";

function configurationSummary(configuration: DrinkConfiguration) {
  const toppings = configuration.toppingIds.map((id) => toppingLabel(id)).join(", ");
  const size = configuration.size[0].toUpperCase() + configuration.size.slice(1);
  return [size, `${configuration.sweetness} sweetness`, configuration.ice, toppings || "No toppings"].join(" · ");
}

function toppingLabel(toppingId: DrinkConfiguration["toppingIds"][number]) {
  return toppingOptions.find((option) => option.id === toppingId)?.label ?? toppingId;
}

export function CartPage() {
  const {
    items,
    itemCount,
    previewTotalMinor,
    incrementItem,
    decrementItem,
    removeItem,
  } = useCart();

  return (
    <div className="customer-shell">
      <a className="skip-link" href="#cart-title">Skip to current order</a>
      <CustomerHeader itemCount={itemCount} />
      <main className="cart-main" aria-labelledby="cart-title">
        <div className="cart-heading">
          <p className="eyebrow">Almost tea time</p>
          <h1 id="cart-title">Your current order</h1>
          <p>Review each cup before heading to the counter.</p>
        </div>
        {items.length === 0 ? (
          <section className="cart-empty" aria-labelledby="empty-title">
            <span aria-hidden="true">○</span>
            <h2 id="empty-title">Your cup is waiting</h2>
            <p>Choose a drink and make it exactly the way you like it.</p>
            <Link className="secondary-link" to="/shop">Browse the menu</Link>
          </section>
        ) : (
          <div className="cart-layout">
            <section aria-label="Order items">
              <ul className="cart-list">
                {items.map((item) => (
                  <li className="cart-item" key={item.id}>
                    <div className="cart-item-copy">
                      <p className="product-category">Customized drink</p>
                      <h2>{item.drinkName}</h2>
                      <p>{configurationSummary(item.configuration)}</p>
                      <button className="remove-button" onClick={() => removeItem(item.id)} type="button">Remove {item.drinkName}</button>
                    </div>
                    <div className="cart-item-actions">
                      <strong>{formatMoney(item.unitPriceMinor * item.quantity)}</strong>
                      <div className="quantity-control">
                        <button aria-label={`Decrease ${item.drinkName} quantity`} onClick={() => decrementItem(item.id)} type="button">−</button>
                        <span aria-live="polite">Quantity {item.quantity}</span>
                        <button aria-label={`Increase ${item.drinkName} quantity`} onClick={() => incrementItem(item.id)} type="button">+</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Link className="back-link" to="/shop">← Add another drink</Link>
            </section>
            <aside className="order-summary" aria-labelledby="summary-title">
              <p className="eyebrow">Pickup summary</p>
              <h2 id="summary-title">Pay at the shop</h2>
              <p>This MVP uses cash payment at pickup. Live checkout will open after the ordering API is connected.</p>
              <dl><div><dt>Items</dt><dd>{itemCount}</dd></div><div className="summary-total"><dt>Preview total</dt><dd>{formatMoney(previewTotalMinor)}</dd></div></dl>
              <button aria-describedby="checkout-note" disabled type="button">Checkout coming soon</button>
              <small id="checkout-note">No order has been submitted and no stock is reserved.</small>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
