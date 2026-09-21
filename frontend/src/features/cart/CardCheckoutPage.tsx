import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { CustomerHeader } from "../../app/CustomerHeader";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { useAuth } from "../auth/useAuth";
import { formatMoney } from "../catalog/formatMoney";
import { useCart } from "./CartContext";
import { cardCheckout, type CardStatus } from "./cardClient";

const terminal = (status: CardStatus) => ["REFUNDED", "EXPIRED", "FAILED"].includes(status.state) || (status.state === "PAID" && !status.cancellationRequested);
export function CardCheckoutPage() {
  const { id = "" } = useParams();
  const { session } = useAuth();
  const { finishCard, checkoutState, itemCount } = useCart();
  const [storedData, setData] = useState<CardStatus>();
  const data = storedData?.id === id ? storedData : undefined;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const original = checkoutState.attempt;
  const identityMatches = original?.cardId !== id || !original.identity || original.identity === session?.userId;
  useEffect(() => {
    if (!identityMatches) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (inFlight.current) { timer = setTimeout(() => { void poll(); }, 15_000); return; }
      inFlight.current = true; setBusy(true);
      try {
        const next = await cardCheckout(id, "refresh");
        if (!stopped) {
          setData(next); setError("");
          if (terminal(next)) finishCard(id);
          else timer = setTimeout(() => { void poll(); }, 15_000);
        }
      } catch {
        if (!stopped) { setError("Payment status is not confirmed. Keep this receipt and check again before placing another order."); timer = setTimeout(() => { void poll(); }, 15_000); }
      } finally { inFlight.current = false; if (!stopped) setBusy(false); }
    }
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [id, identityMatches, finishCard]);
  async function action(cancel: boolean) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const next = await cardCheckout(id, cancel ? "cancel" : "refresh"); setData(next);
      if (terminal(next)) finishCard(id);
    } catch { setError("The result could not be confirmed. Retry this checkout; do not place a replacement order yet."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="customer-shell"><CustomerHeader itemCount={itemCount} />
    <main className="mx-auto max-w-2xl px-4 py-10"><h1 className="mb-6 text-3xl">Card payment</h1>
      {!identityMatches ? <p>Sign in to the original account to recover this payment. <Link to="/account/access">Sign in</Link></p> : <Card>
        <CardHeader><CardTitle><h2>{data ? `Order ${data.order.publicOrderNumber}` : "Checking your payment"}</h2></CardTitle></CardHeader>
        <CardContent className="grid gap-5">
          {data ? <>
            <p role="status">{data.state === "PAID" && !data.cancellationRequested ? "Paid online. Show your order number when collecting your drinks."
              : data.state === "REFUNDED" ? "Payment refunded. Your receipt remains available."
              : ["EXPIRED", "FAILED"].includes(data.state) ? "This checkout ended without a confirmed payment. The order is cancelled."
              : data.state === "REFUND_PENDING" ? "Your cancellation is being processed. Stock stays reserved until the refund is confirmed."
              : data.state === "REVIEW_REQUIRED" ? "The shop needs to review this payment. Keep your order number and ask staff for help."
              : data.cancellationRequested ? "Cancelling this checkout. Wait for confirmation before ordering again."
              : "Your ingredients are reserved while you pay. Payment is confirmed only after the shop verifies it."}</p>
            <dl className="grid gap-2 rounded-lg bg-muted p-4"><div className="flex justify-between"><dt>Order total</dt><dd>{formatMoney(data.order.totalMinor, data.order.currencyCode)}</dd></div>
              <div className="flex justify-between"><dt>Order status</dt><dd>{data.order.status}</dd></div>
              {data.refundedMinor > 0 ? <div className="flex justify-between"><dt>Refunded</dt><dd>{formatMoney(data.refundedMinor, data.order.currencyCode)}</dd></div> : null}</dl>
            <ul className="grid gap-2">{data.order.items.map((item, index) => <li key={index}>{item.quantity} × {item.productName} · {item.variantName}</li>)}</ul>
            {data.recoveryCode ? <p>Payment updates need attention. Try checking again or ask the shop for help.</p> : null}
            {data.checkoutUrl && !data.cancellationRequested ? <Button asChild><a href={data.checkoutUrl}>Pay securely by card</a></Button> : null}
            {!terminal(data) && data.state !== "REFUND_PENDING" ? <Button variant="outline" disabled={busy || data.cancellationRequested} onClick={() => { void action(true); }}>Cancel this checkout</Button> : null}
            {terminal(data) ? <Button asChild variant="outline"><Link to="/shop">Back to shops</Link></Button> : null}
          </> : <p role="status">Verifying the latest payment status…</p>}
          {error ? <p role="alert">{error}</p> : null}
          <Button variant="outline" isLoading={busy} loadingLabel="Checking payment…" onClick={() => { void action(false); }}>Check payment status</Button>
        </CardContent></Card>}
    </main></div>;
}
