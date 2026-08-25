import { useEffect, useState } from "react";
import { Link } from "react-router";

import { Pagination, ProblemState } from "../../components/shared";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { cn } from "../../lib/utils";
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
    <section aria-labelledby="order-history-title" className="grid gap-5" id="order-history">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">Receipts</p>
          <h2 className="text-2xl" id="order-history-title">Order history</h2>
        </div>
        {visibleState.status === "ready" && visibleState.data.totalItems > 0 ? (
          <p className="text-sm text-muted-foreground">{visibleState.data.totalItems} {visibleState.data.totalItems === 1 ? "order" : "orders"}</p>
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
        <Card><CardContent className="grid justify-items-start gap-4 pt-4">
          <h3>No orders yet</h3>
          <p className="text-muted-foreground">Your account-linked orders will appear here after checkout.</p>
          <Button asChild variant="outline"><Link to="/">Browse the menu</Link></Button>
        </CardContent></Card>
      ) : null}
      {visibleState.status === "ready" && visibleState.data.items.length > 0 ? (
        <>
          <ol className="grid list-none gap-4 p-0">
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
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-primary uppercase">{formatOrderDate(order.createdAt)}</p>
            <h3>Order {order.publicOrderNumber}</h3>
          </div>
          <Badge className={cn(order.status === "COMPLETED" && "bg-success text-success-foreground", order.status === "PENDING" && "bg-warning text-warning-foreground")} variant={order.status === "CANCELLED" ? "destructive" : "secondary"}>
            {orderStatusLabel(order.status)}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
        <p>{preview}</p>
        <p className="flex flex-wrap justify-between gap-3 text-sm text-muted-foreground">
          <span>{order.location.name}</span>
          <strong className="text-foreground">{formatMoney(order.totalMinor, order.currencyCode)}</strong>
        </p>
        <Button asChild className="w-fit" variant="outline"><Link to={`/account/orders/${order.id}`}>View order {order.publicOrderNumber}</Link></Button>
        </CardContent>
      </Card>
    </li>
  );
}
