import { useEffect, useState } from "react";
import { Link } from "react-router";

import { Button } from "../../components/ui/Button";
import { useAuth } from "../auth/useAuth";
import { useCart } from "../cart/CartContext";
import { formatMoney } from "../catalog/formatMoney";
import {
  getLatestCustomerReorder,
  type CustomerReorderSuggestion,
} from "./customerOrderClient";
import { formatOrderDate } from "./orderPresentation";
import "./customerOrders.css";

type SuggestionState =
  | { status: "hidden" }
  | { status: "error"; accessToken: string; locationSlug: string }
  | {
      status: "ready";
      accessToken: string;
      locationSlug: string;
      suggestion: CustomerReorderSuggestion;
    };

export function LastOrderSuggestion({ locationSlug }: { locationSlug: string }) {
  const { isLoading, session } = useAuth();
  const { addOrder } = useCart();
  const [retryKey, setRetryKey] = useState(0);
  const [cartMessage, setCartMessage] = useState<{ orderId: string; text: string }>();
  const [state, setState] = useState<SuggestionState>({ status: "hidden" });
  const accessToken = session?.accessToken ?? "";

  useEffect(() => {
    if (isLoading || accessToken.length === 0) return;

    const controller = new AbortController();
    getLatestCustomerReorder(accessToken, locationSlug, controller.signal)
      .then((suggestion) => setState(suggestion === undefined
        ? { status: "hidden" }
        : { status: "ready", accessToken, locationSlug, suggestion }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error", accessToken, locationSlug });
        }
      });
    return () => controller.abort();
  }, [accessToken, isLoading, locationSlug, retryKey]);

  if (
    isLoading ||
    accessToken.length === 0 ||
    state.status === "hidden" ||
    state.accessToken !== accessToken ||
    state.locationSlug !== locationSlug
  ) return null;

  if (state.status === "error") {
    return (
      <aside className="last-order last-order--error" aria-label="Last order suggestion">
        <p>We couldn’t load your last order.</p>
        <Button onClick={() => setRetryKey((value) => value + 1)} size="compact" variant="secondary">
          Try again
        </Button>
      </aside>
    );
  }

  const { suggestion } = state;

  function addLastOrder() {
    const added = addOrder(suggestion.items.map((item) => ({
      quantity: item.quantity,
      draft: {
        locationSlug: suggestion.location.slug,
        drinkId: item.productSlug,
        drinkName: item.productName,
        configuration: {
          variantId: item.variantId,
          variantName: item.variantName,
          selections: item.selections.map((selection) => ({
            groupId: selection.groupId,
            groupName: selection.groupName,
            choiceIds: [...selection.choiceIds],
            choiceNames: [...selection.choiceNames],
          })),
        },
        unitPriceMinor: item.unitPriceMinor,
        currency: suggestion.currencyCode,
      },
    })));
    setCartMessage({
      orderId: suggestion.orderId,
      text: added
        ? "Added your last order to the cart."
        : "Your cart can’t fit this order. Clear it before adding your last order.",
    });
  }

  return (
    <section aria-labelledby="last-order-title" className="last-order">
      <div className="last-order__content">
        <p className="eyebrow">Welcome back</p>
        <h2 id="last-order-title">Order again</h2>
        <ul className="last-order__items">
          {suggestion.items.map((item) => (
            <li key={`${item.variantId}-${item.selections.flatMap((selection) => selection.choiceIds).join("-")}`}>
              <div>
                <h3>{item.quantity} × {item.productName}</h3>
                <p>
                  {[item.variantName, ...item.selections.flatMap((selection) => selection.choiceNames)]
                    .join(" · ")}
                </p>
              </div>
              <strong>
                {formatMoney(item.unitPriceMinor * item.quantity, suggestion.currencyCode)}
              </strong>
            </li>
          ))}
        </ul>
        <p className="last-order__meta">
          <span>{formatOrderDate(suggestion.createdAt)}</span> · <span>{suggestion.location.name}</span>
        </p>
        <p aria-live="polite" className="last-order__message" role="status">
          {cartMessage?.orderId === suggestion.orderId ? cartMessage.text : ""}
        </p>
      </div>
      <div className="last-order__action">
        <span>Current total</span>
        <strong>{formatMoney(suggestion.totalMinor, suggestion.currencyCode)}</strong>
        <Button onClick={addLastOrder}>Add order to cart</Button>
        <Link to={`/account/orders/${suggestion.orderId}`}>View last order</Link>
      </div>
    </section>
  );
}
