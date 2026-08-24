import { useEffect, useState } from "react";
import { Link } from "react-router";

import { Button } from "../../components/ui/Button";
import { useAuth } from "../auth/useAuth";
import { formatMoney } from "../catalog/formatMoney";
import { listCustomerOrders, type CustomerOrderSummary } from "./customerOrderClient";
import { formatOrderDate, orderStatusLabel } from "./orderPresentation";
import "./customerOrders.css";

type SuggestionState =
  | { status: "hidden" }
  | { status: "error"; accessToken: string }
  | { status: "ready"; accessToken: string; order: CustomerOrderSummary };

export function LastOrderSuggestion() {
  const { isLoading, session } = useAuth();
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<SuggestionState>({ status: "hidden" });
  const accessToken = session?.accessToken ?? "";

  useEffect(() => {
    if (isLoading || accessToken.length === 0) return;

    const controller = new AbortController();
    listCustomerOrders(accessToken, { page: 0, size: 1 }, controller.signal)
      .then((result) => setState(result.items[0] === undefined
        ? { status: "hidden" }
        : { status: "ready", accessToken, order: result.items[0] }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error", accessToken });
        }
      });
    return () => controller.abort();
  }, [accessToken, isLoading, retryKey]);

  if (
    isLoading ||
    accessToken.length === 0 ||
    state.status === "hidden" ||
    state.accessToken !== accessToken
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

  const { order } = state;
  const itemPreview = order.items
    .map((item) => `${item.productName} · ${item.variantName}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`)
    .join(", ");

  return (
    <section aria-labelledby="last-order-title" className="last-order">
      <div>
        <p className="eyebrow">Welcome back</p>
        <h2 id="last-order-title">Last ordered</h2>
        <p className="last-order__items">{itemPreview}</p>
        <p className="last-order__meta">
          <span>{formatOrderDate(order.createdAt)}</span> · <span>{order.location.name}</span> · {orderStatusLabel(order.status)}
        </p>
      </div>
      <div className="last-order__action">
        <strong>{formatMoney(order.totalMinor, order.currencyCode)}</strong>
        <Link to={`/account/orders/${order.id}`}>View last order</Link>
      </div>
    </section>
  );
}
