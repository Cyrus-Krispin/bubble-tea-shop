import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { ProblemState } from "../../components/ui/ProblemState";
import { useAuth } from "../auth/useAuth";
import { formatMoney } from "../catalog/formatMoney";
import {
  CustomerOrderError,
  getCustomerOrder,
  type CustomerOrderDetail,
  type CustomerOrderLine,
} from "./customerOrderClient";
import { formatOrderDate, orderStatusLabel } from "./orderPresentation";
import "./customerOrders.css";

type DetailState =
  | { status: "loading" }
  | { status: "error"; notFound: boolean; requestKey: string }
  | { status: "ready"; data: CustomerOrderDetail; requestKey: string };

export function CustomerOrderDetailPage() {
  const { isLoading, session } = useAuth();
  const { orderId = "" } = useParams();
  const location = useLocation();
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const accessToken = session?.accessToken ?? "";
  const requestKey = `${accessToken}:${orderId}:${retryKey}`;

  useEffect(() => {
    if (isLoading || accessToken.length === 0 || orderId.length === 0) return;
    const controller = new AbortController();
    getCustomerOrder(accessToken, orderId, controller.signal)
      .then((data) => setState({ status: "ready", data, requestKey }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({
            status: "error",
            notFound: error instanceof CustomerOrderError && error.code === "CUSTOMER_ORDER_NOT_FOUND",
            requestKey,
          });
        }
      });
    return () => controller.abort();
  }, [accessToken, isLoading, orderId, requestKey]);

  const visibleState = state.status !== "loading" && state.requestKey !== requestKey
    ? { status: "loading" as const }
    : state;

  return (
    <div className="customer-shell">
      <CustomerHeader />
      <main className="order-detail-page">
        {isLoading ? <p role="status">Loading your account…</p> : null}
        {!isLoading && session === null ? (
          <section className="account-panel" aria-labelledby="order-sign-in-title">
            <p className="eyebrow">Customer receipt</p>
            <h1 id="order-sign-in-title">Sign in to view this order</h1>
            <p>Receipts are private to the customer account that placed the order.</p>
            <Link
              className="primary-link"
              to={`/account/access?mode=sign-in&next=${encodeURIComponent(location.pathname)}`}
            >
              Sign in
            </Link>
          </section>
        ) : null}
        {!isLoading && session !== null && visibleState.status === "loading" ? (
          <p role="status">Loading your receipt…</p>
        ) : null}
        {!isLoading && session !== null && visibleState.status === "error" ? (
          <ProblemState
            message={visibleState.notFound
              ? "This order could not be found in your account."
              : "We couldn’t load this order right now."}
            onRetry={visibleState.notFound ? undefined : () => setRetryKey((value) => value + 1)}
            title={visibleState.notFound ? "Order not found" : "Receipt unavailable"}
          />
        ) : null}
        {!isLoading && session !== null && visibleState.status === "ready" ? (
          <Receipt order={visibleState.data} />
        ) : null}
      </main>
    </div>
  );
}

function Receipt({ order }: { order: CustomerOrderDetail }) {
  const nextStep = order.status === "PENDING"
    ? "Your order is pending. Pay cash at the shop when you pick it up."
    : order.status === "COMPLETED"
      ? "This order is complete. Your receipt remains available here."
      : "This order was cancelled. No pickup is required.";
  return (
    <article aria-labelledby="receipt-title" className="receipt">
      <Link aria-label="Back to order history" className="receipt__back" to="/account#order-history">
        <span aria-hidden="true">← </span>Back to order history
      </Link>
      <header className="receipt__heading">
        <div>
          <p className="eyebrow">Customer receipt</p>
          <h1 id="receipt-title">Order {order.publicOrderNumber}</h1>
          <p>{formatOrderDate(order.createdAt)} · {order.location.name}</p>
        </div>
        <span aria-label={`Order status: ${orderStatusLabel(order.status)}`} className={`order-status order-status--${order.status.toLowerCase()}`}>
          {orderStatusLabel(order.status)}
        </span>
      </header>

      <p className={`receipt__next-step receipt__next-step--${order.status.toLowerCase()}`}>{nextStep}</p>

      <ol className="receipt__lines">
        {order.items.map((line) => <ReceiptLine currency={order.currencyCode} key={line.lineNumber} line={line} />)}
      </ol>

      <dl className="receipt__totals">
        <div><dt>Subtotal</dt><dd>{formatMoney(order.subtotalMinor, order.currencyCode)}</dd></div>
        <div className="receipt__total"><dt>Total</dt><dd>{formatMoney(order.totalMinor, order.currencyCode)}</dd></div>
        <div><dt>Payment</dt><dd>{order.paymentMethod === "CASH" ? "Cash" : order.paymentMethod}</dd></div>
      </dl>
      <p className="receipt__note">This receipt preserves the names and prices from when you ordered.</p>
    </article>
  );
}

function ReceiptLine({ currency, line }: { currency: string; line: CustomerOrderLine }) {
  const choices = line.options.map((option) => option.choiceName);
  return (
    <li>
      <div>
        <h2>{line.productName}</h2>
        <p>{[line.variantName, ...choices].join(" · ")}</p>
        <p>Quantity {line.quantity}</p>
      </div>
      <strong>{formatMoney(line.lineTotalMinor, currency)}</strong>
    </li>
  );
}
