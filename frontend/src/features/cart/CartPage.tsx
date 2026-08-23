import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { formatMoney } from "../catalog/formatMoney";
import type { DrinkConfiguration } from "../catalog/pricing";
import { useAuth } from "../auth/useAuth";
import { useCart } from "./CartContext";
import { MAX_LINE_QUANTITY, MAX_ORDER_QUANTITY } from "./cartReducer";
import { OrderError, placeGuestOrder, type GuestOrder } from "./orderClient";
import "./cart.css";

function configurationSummary(configuration: DrinkConfiguration) {
  const choices = configuration.selections.map((selection) => (
    selection.choiceNames.length > 0
      ? selection.choiceNames.join(", ")
      : `No ${selection.groupName.toLowerCase()}`
  ));
  return [configuration.variantName, ...choices].join(" · ");
}

export function CartPage() {
  const { session } = useAuth();
  const {
    items,
    itemCount,
    previewTotalMinor,
    incrementItem,
    decrementItem,
    removeItem,
    clearCart,
  } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [placedOrder, setPlacedOrder] = useState<GuestOrder>();
  const retryKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    retryKey.current = undefined;
  }, [items]);

  async function checkout() {
    if (submitting || items.length === 0) return;
    setSubmitting(true);
    setSubmitError(undefined);
    const key = retryKey.current ?? crypto.randomUUID();
    retryKey.current = key;
    try {
      const order = await placeGuestOrder({
        items: items.map((item) => ({
          variantId: item.configuration.variantId,
          quantity: item.quantity,
          optionChoiceIds: item.configuration.selections.flatMap((selection) => selection.choiceIds),
        })),
      }, key, session?.accessToken);
      retryKey.current = undefined;
      setPlacedOrder(order);
      clearCart();
    } catch (error) {
      if (error instanceof OrderError) {
        retryKey.current = undefined;
        if (error.code === "ORDER_CATALOG_CHANGED") {
          setSubmitError("The menu changed while you were ordering. Review the current menu and update this order before trying again.");
        } else if (error.code === "CUSTOMER_ACCOUNT_DISABLED") {
          setSubmitError("Your signed-in account is unavailable. Sign out or contact the shop before trying again.");
        } else if (error.code === "ORDER_INVALID" || error.code === "ORDER_IDEMPOTENCY_CONFLICT") {
          setSubmitError("This order could not be submitted safely. Review it and try again.");
        } else {
          setSubmitError("Ordering is temporarily unavailable. Your order is still here; try again shortly.");
        }
      } else {
        setSubmitError("We couldn’t confirm whether the order reached the shop. Your order is still here; retry to check safely without creating a duplicate.");
      }
    } finally {
      setSubmitting(false);
    }
  }

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
        {placedOrder !== undefined ? (
          <section className="cart-confirmation" aria-labelledby="confirmation-title">
            <p className="eyebrow">Order confirmed</p>
            <h2 id="confirmation-title">Pickup {placedOrder.publicOrderNumber}</h2>
            <p>Your order is pending. Pay {formatMoney(placedOrder.totalMinor, placedOrder.currencyCode)} in cash at the shop when it is ready.</p>
            <dl>
              <div><dt>Status</dt><dd>Pending</dd></div>
              <div><dt>Items</dt><dd>{placedOrder.items.reduce((total, item) => total + item.quantity, 0)}</dd></div>
              <div><dt>Confirmed total</dt><dd>{formatMoney(placedOrder.totalMinor, placedOrder.currencyCode)}</dd></div>
            </dl>
            <Link className="secondary-link" to="/shop">Start another order</Link>
          </section>
        ) : items.length === 0 ? (
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
                      <button className="remove-button" disabled={submitting} onClick={() => removeItem(item.id)} type="button">Remove {item.drinkName}</button>
                    </div>
                    <div className="cart-item-actions">
                      <strong>{formatMoney(item.unitPriceMinor * item.quantity, item.currency)}</strong>
                      <div className="quantity-control">
                        <button aria-label={`Decrease ${item.drinkName} quantity`} disabled={submitting} onClick={() => decrementItem(item.id)} type="button">−</button>
                        <span aria-live="polite">Quantity {item.quantity}</span>
                        <button aria-label={`Increase ${item.drinkName} quantity`} disabled={submitting || item.quantity >= MAX_LINE_QUANTITY || itemCount >= MAX_ORDER_QUANTITY} onClick={() => incrementItem(item.id)} type="button">+</button>
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
              <p>Your final price is recalculated from the live menu before the order is accepted.</p>
              <dl><div><dt>Items</dt><dd>{itemCount}</dd></div><div className="summary-total"><dt>Preview total</dt><dd>{formatMoney(previewTotalMinor, items[0].currency)}</dd></div></dl>
              <button aria-describedby="checkout-note" disabled={submitting} onClick={checkout} type="button">{submitting ? "Placing order…" : "Place cash order"}</button>
              <small id="checkout-note">Placement creates a pending order. Stock is checked when staff complete it.</small>
              {submitError === undefined ? null : <p className="checkout-error" role="alert">{submitError}</p>}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
