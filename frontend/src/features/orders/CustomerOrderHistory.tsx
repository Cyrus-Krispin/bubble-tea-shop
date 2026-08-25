import { useEffect, useState } from "react";
import { Link } from "react-router";

import { Pagination, ProblemState } from "../../components/shared";
import { formatMoney } from "../catalog/formatMoney";
import {
  listCustomerOrders,
  type CustomerOrderPage,
  type CustomerOrderSummary,
} from "./customerOrderClient";
import { formatOrderDate, orderStatusLabel } from "./orderPresentation";
import "./customerOrders.css";

const PAGE_SIZE = 5;

type HistoryState =
  | { status: "loading" }
  | { status: "error"; requestKey: string }
  | { status: "ready"; data: CustomerOrderPage; requestKey: string };

export function CustomerOrderHistory({ accessToken }: { accessToken: string }) {
  const [page, setPage] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const requestKey = `${accessToken}:${page}:${retryKey}`;

  useEffect(() => {
    const controller = new AbortController();
    listCustomerOrders(accessToken, { page, size: PAGE_SIZE }, controller.signal)
      .then((data) => setState({ status: "ready", data, requestKey }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error", requestKey });
        }
      });
    return () => controller.abort();
  }, [accessToken, page, requestKey]);

  const visibleState = state.status !== "loading" && state.requestKey !== requestKey
    ? { status: "loading" as const }
    : state;

  return (
    <section aria-labelledby="order-history-title" className="order-history" id="order-history">
      <div className="order-section-heading">
        <div>
          <p className="eyebrow">Receipts</p>
          <h2 id="order-history-title">Order history</h2>
        </div>
        {visibleState.status === "ready" && visibleState.data.totalItems > 0 ? (
          <p>{visibleState.data.totalItems} {visibleState.data.totalItems === 1 ? "order" : "orders"}</p>
        ) : null}
      </div>

      {visibleState.status === "loading" ? <p role="status">Loading your orders…</p> : null}
      {visibleState.status === "error" ? (
        <ProblemState
          message="We couldn’t load your order history."
          onRetry={() => setRetryKey((value) => value + 1)}
          title="Order history unavailable"
        />
      ) : null}
      {visibleState.status === "ready" && visibleState.data.items.length === 0 ? (
        <div className="order-empty">
          <h3>No orders yet</h3>
          <p>Your account-linked orders will appear here after checkout.</p>
          <Link to="/">Browse the menu</Link>
        </div>
      ) : null}
      {visibleState.status === "ready" && visibleState.data.items.length > 0 ? (
        <>
          <ol className="order-list">
            {visibleState.data.items.map((order) => <OrderCard key={order.id} order={order} />)}
          </ol>
          <Pagination
            currentPage={visibleState.data.page + 1}
            label="Order history pages"
            onPageChange={(nextPage) => setPage(nextPage - 1)}
            totalPages={visibleState.data.totalPages}
          />
        </>
      ) : null}
    </section>
  );
}

function OrderCard({ order }: { order: CustomerOrderSummary }) {
  const preview = order.items
    .map((item) => `${item.productName} · ${item.variantName}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`)
    .join(", ");

  return (
    <li>
      <article className="order-card">
        <div className="order-card__heading">
          <div>
            <p className="card-kicker">{formatOrderDate(order.createdAt)}</p>
            <h3>Order {order.publicOrderNumber}</h3>
          </div>
          <span className={`order-status order-status--${order.status.toLowerCase()}`}>
            {orderStatusLabel(order.status)}
          </span>
        </div>
        <p className="order-card__items">{preview}</p>
        <p className="order-card__meta">
          <span>{order.location.name}</span>
          <strong>{formatMoney(order.totalMinor, order.currencyCode)}</strong>
        </p>
        <Link to={`/account/orders/${order.id}`}>View order {order.publicOrderNumber}</Link>
      </article>
    </li>
  );
}
