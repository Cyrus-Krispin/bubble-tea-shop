import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { ProblemState } from "../../components/shared";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { cn } from "../../lib/utils";
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
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        {isLoading ? <p role="status">Loading your account…</p> : null}
        {!isLoading && session === null ? (
          <Card aria-labelledby="order-sign-in-title"><CardHeader><p className="text-xs font-semibold tracking-widest text-primary uppercase">Customer receipt</p><CardTitle><h1 className="text-3xl" id="order-sign-in-title">Sign in to view this order</h1></CardTitle></CardHeader><CardContent className="grid gap-5"><p className="text-muted-foreground">Receipts are private to the customer account that placed the order.</p><Button asChild className="w-fit"><Link to={`/account/access?mode=sign-in&next=${encodeURIComponent(location.pathname)}`}>Sign in</Link></Button></CardContent></Card>
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
    <article aria-labelledby="receipt-title" className="grid gap-5">
      <Button asChild className="w-fit" variant="ghost"><Link aria-label="Back to order history" to="/account#order-history"><span aria-hidden="true">← </span>Back to order history</Link></Button>
      <Card><CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">Customer receipt</p>
          <h1 className="text-3xl" id="receipt-title">Order {order.publicOrderNumber}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{formatOrderDate(order.createdAt)} · {order.location.name}</p>
        </div>
        <Badge aria-label={`Order status: ${orderStatusLabel(order.status)}`} className={cn(order.status === "COMPLETED" && "bg-success text-success-foreground", order.status === "PENDING" && "bg-warning text-warning-foreground")} variant={order.status === "CANCELLED" ? "destructive" : "secondary"}>
          {orderStatusLabel(order.status)}
        </Badge>
      </CardHeader><CardContent className="grid gap-5">

      <p className={cn("rounded-lg border-l-3 p-4 text-sm leading-6", order.status === "COMPLETED" ? "border-success-foreground bg-success" : order.status === "PENDING" ? "border-warning-foreground bg-warning" : "border-destructive bg-destructive/10")}>{nextStep}</p>

      <ol className="grid list-none divide-y rounded-lg border p-0">
        {order.items.map((line) => <ReceiptLine currency={order.currencyCode} key={line.lineNumber} line={line} />)}
      </ol>

      <dl className="grid gap-3 rounded-lg bg-muted p-4">
        <div className="flex justify-between gap-4"><dt>Subtotal</dt><dd>{formatMoney(order.subtotalMinor, order.currencyCode)}</dd></div>
        <div className="flex justify-between gap-4 text-lg font-semibold"><dt>Total</dt><dd>{formatMoney(order.totalMinor, order.currencyCode)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Payment</dt><dd>{order.paymentMethod === "CASH" ? "Cash" : order.paymentMethod}</dd></div>
      </dl>
      <p className="text-sm text-muted-foreground">This receipt preserves the names and prices from when you ordered.</p>
      </CardContent></Card>
    </article>
  );
}

function ReceiptLine({ currency, line }: { currency: string; line: CustomerOrderLine }) {
  const choices = line.options.map((option) => option.choiceName);
  return (
    <li className="flex items-start justify-between gap-4 p-4">
      <div>
        <h2 className="text-base">{line.productName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{[line.variantName, ...choices].join(" · ")}</p>
        <p className="mt-1 text-sm text-muted-foreground">Quantity {line.quantity}</p>
      </div>
      <strong>{formatMoney(line.lineTotalMinor, currency)}</strong>
    </li>
  );
}
