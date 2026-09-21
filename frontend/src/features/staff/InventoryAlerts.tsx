import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { getInventoryAlerts } from "./forecastClient";

type Props = { accessToken: string; organizationId: string; locationId: string };
type Summary = Awaited<ReturnType<typeof getInventoryAlerts>>;

export function InventoryAlerts({ accessToken, organizationId, locationId }: Props) {
  const [state, setState] = useState<{ data?: Summary; error?: boolean }>({});
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let request: AbortController | undefined;
    function refresh() {
      if (document.visibilityState === "hidden") return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      getInventoryAlerts(accessToken, organizationId, locationId, controller.signal)
        .then((data) => { if (!controller.signal.aborted) setState({ data }); })
        .catch(() => { if (!controller.signal.aborted) setState({ error: true }); });
    }
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      request?.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [accessToken, organizationId, locationId, reload]);
  if (state.error) return <Alert><AlertTitle>Stock alerts unavailable</AlertTitle><AlertDescription>
    Current shortage warnings could not be checked.
    <Button size="compact" variant="outline" onClick={() => setReload((n) => n + 1)}>Retry alerts</Button>
  </AlertDescription></Alert>;
  if (!state.data) return <p role="status" className="text-sm text-muted-foreground">Checking stock alerts…</p>;
  if (state.data.totalItems === 0) return <p role="status" className="text-sm text-muted-foreground">No projected shortages within {state.data.horizonDays} days. Ingredients without demand history cannot be predicted.</p>;
  return <Alert role="status"><AlertTitle>{state.data.totalItems} ingredient{state.data.totalItems === 1 ? "" : "s"} may run out within {state.data.horizonDays} days</AlertTitle>
    <AlertDescription><ul className="list-disc pl-4">{state.data.items.map((item) => <li key={item.ingredientId}>
      {item.ingredientName}: {item.status === "OUT_OF_STOCK" ? "out of stock" : `about ${item.daysRemaining} days remaining`}
      {item.observedDays < 30 ? " (limited history)" : ""}
    </li>)}</ul>{state.data.totalItems > state.data.items.length ? <p>Showing the first {state.data.items.length} shortages.</p> : null}
    <p>Checked {new Date(state.data.calculatedAt).toLocaleTimeString()}. Updates every minute.</p>
  </AlertDescription></Alert>;
}
