import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/shared";
import { staffCardPayment, type CardStatus } from "../cart/cardClient";

export function StaffCardPayment({ token, organizationId, locationId, orderId, onState, onChanged }: {
  token: string; organizationId: string; locationId: string; orderId: string;
  onState: (status: CardStatus | undefined) => void; onChanged: () => void;
}) {
  const [data, setData] = useState<CardStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  useEffect(() => {
    let stopped = false;
    onState(undefined);
    staffCardPayment(token, organizationId, locationId, orderId, "refresh").then((next) => {
      if (!stopped) { setData(next); onState(next); }
    }).catch(() => { if (!stopped) setError("Payment status is unavailable. Check again before preparing this order."); });
    return () => { stopped = true; };
  }, [token, organizationId, locationId, orderId, onState]);
  async function update(cancel: boolean) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const next = await staffCardPayment(token, organizationId, locationId, orderId, cancel ? "cancel" : "refresh");
      setData(next); onState(next); setCancelOpen(false); onChanged();
    } catch { setError("Payment update could not be confirmed. Check this same order again before taking another action."); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-3 rounded-lg border p-4" aria-label="Online card payment">
    <h3>Online card payment</h3>
    <p role="status">{data ? data.state.replaceAll("_", " ") : "Checking payment…"}</p>
    <p>No cash is due for this order. Complete it only after online payment is confirmed.</p>
    {data?.cancellationRequested ? <p>Cancellation requested. Do not prepare the drinks; stock remains held until expiry or refund is confirmed.</p> : null}
    {data?.state === "REVIEW_REQUIRED" || data?.recoveryCode ? <p>Payment needs investigation. Check the payment provider and retry reconciliation. Keep the stock reserved.</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <Button variant="outline" disabled={busy} onClick={() => { void update(false); }}>Check online payment</Button>
    {data?.order.status === "PENDING" && !data.cancellationRequested ? <Dialog open={cancelOpen} onOpenChange={setCancelOpen}
      title="Cancel this card order" description="Cancel the unpaid checkout or refund a collected payment. Ingredients are released only after the provider confirms expiry or the full refund."
      trigger={<Button variant="outline" disabled={busy}>Cancel or refund order</Button>}>
      {error ? <p role="alert">{error}</p> : null}
      <Button disabled={busy} onClick={() => { void update(true); }}>Confirm cancellation</Button>
    </Dialog> : null}
  </section>;
}
