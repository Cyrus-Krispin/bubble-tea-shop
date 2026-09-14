import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination } from "../../components/shared/Pagination";
import { ProblemState } from "../../components/shared/ProblemState";
import { getForecasts, type ForecastPage } from "./forecastClient";

type Props = { accessToken: string; organizationId: string; locationId: string };

function ForecastResults({ accessToken, organizationId, locationId }: Props) {
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<{ data?: ForecastPage; error?: boolean }>({});
  useEffect(() => {
    const controller = new AbortController();
    getForecasts(accessToken, organizationId, locationId, page, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ data }); })
      .catch(() => { if (!controller.signal.aborted) setState({ error: true }); });
    return () => controller.abort();
  }, [accessToken, organizationId, locationId, page, reload]);
  function refresh(nextPage = page) { setState({}); setPage(nextPage); setReload((n) => n + 1); }
  if (state.error) return <ProblemState title="Forecasts unavailable" message="We could not load current estimates. Try again."
    actionLabel="Try again" onRetry={() => refresh()} />;
  if (!state.data) return <p role="status">Calculating consumption…</p>;
  return <div className="grid gap-4">
    <p className="text-sm text-muted-foreground">Based on completed sales over up to 30 full local days. Stockouts can understate demand.
      {" "}Calculated {new Date(state.data.calculatedAt).toLocaleString()}.</p>
    <Button variant="outline" onClick={() => refresh()}>Refresh forecasts</Button>
    {state.data.items.length === 0 ? <p role="status">No active ingredients.</p> : <Table>
      <TableHeader><TableRow><TableHead>Ingredient</TableHead><TableHead>Estimated stock remaining</TableHead></TableRow></TableHeader>
      <TableBody>{state.data.items.map((item) => <TableRow key={item.ingredientId}>
        <TableCell className="whitespace-normal"><strong>{item.ingredientName}</strong>
          <div className="text-xs text-muted-foreground">{item.quantity} {item.baseUnit.toLowerCase()} on hand</div>
          <div className="text-xs text-muted-foreground">{item.dailyConsumption ?? "Unknown"} used per day</div>
        </TableCell>
        <TableCell className="whitespace-normal">{item.status === "OUT_OF_STOCK" ? "Out of stock" : item.daysRemaining !== null ? `${item.daysRemaining} days`
          : item.status === "NO_OBSERVED_DEMAND" ? "No observed demand" : "Insufficient history"}
          <div className="text-xs text-muted-foreground">{item.observedDays} days{item.observedDays < 30 ? " · limited history" : ""}</div>
        </TableCell>
      </TableRow>)}</TableBody>
    </Table>}
    <Pagination currentPage={page + 1} totalPages={state.data.totalPages} onPageChange={(n) => refresh(n - 1)} />
  </div>;
}

export function InventoryForecastPanel(props: Props) {
  const [visible, setVisible] = useState(false);
  return <Card><CardHeader><CardTitle><h2>Consumption forecasts</h2></CardTitle></CardHeader>
    <CardContent>{visible ? <ForecastResults key={`${props.accessToken}:${props.organizationId}:${props.locationId}`} {...props} />
      : <Button variant="outline" onClick={() => setVisible(true)}>Show consumption forecasts</Button>}</CardContent></Card>;
}
