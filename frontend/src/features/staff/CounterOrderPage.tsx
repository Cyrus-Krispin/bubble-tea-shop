import { useStaffDraft } from "./StaffDraftContext";
import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { SelectField } from "../../components/shared/SelectField";
import { ProblemState } from "../../components/shared/ProblemState";
import { getGuestLocations, getGuestMenu, getGuestProduct } from "../catalog/catalogClient";
import { formatMoney } from "../catalog/formatMoney";
import type { CatalogLocation, CatalogMenu, CatalogProduct } from "../catalog/types";
import { OrderError, placeCounterOrder, type GuestOrder } from "../cart/orderClient";
import { CounterDrink, type CounterLine } from "./CounterDrink";
import type { StaffOutletContext } from "./StaffLayout";

type Scope = CatalogLocation & { organizationId: string };

function CounterComposer({ scope, accessToken, onBusyChange }: { scope: Scope; accessToken: string; onBusyChange: (busy: boolean) => void }) {
  const [menu, setMenu] = useState<CatalogMenu>();
  const [product, setProduct] = useState<CatalogProduct>();
  const [productSlug, setProductSlug] = useState("");
  const [lines, setLines] = useStaffDraft<CounterLine[]>(`counter:${scope.id}:lines`, []);
  const [error, setError] = useStaffDraft(`counter:${scope.id}:error`, "");
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [attempt, setAttempt] = useStaffDraft<string | undefined>(`counter:${scope.id}:key`, undefined);
  const [submitting, setSubmitting] = useStaffDraft(`counter:${scope.id}:busy`, false);
  const [placed, setPlaced] = useStaffDraft<GuestOrder | undefined>(`counter:${scope.id}:placed`, undefined);
  useEffect(() => {
    onBusyChange(lines.length > 0 || attempt !== undefined);
    return () => onBusyChange(false);
  }, [lines.length, attempt, onBusyChange]);
  useEffect(() => {
    const controller = new AbortController();
    getGuestMenu(scope.slug, controller.signal).then((next) => {
      if (!controller.signal.aborted) { setMenu(next); setProductSlug(next.products.find((item) => item.available)?.slug ?? ""); setLoadError(false); }
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [scope.slug, reload]);
  useEffect(() => {
    if (!productSlug) return;
    const controller = new AbortController();
    getGuestProduct(productSlug, scope.slug, controller.signal).then((next) => {
      if (!controller.signal.aborted) { setProduct(next); setLoadError(false); }
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [productSlug, scope.slug, reload]);
  async function submit() {
    if (submitting || lines.length === 0) return;
    const key = attempt ?? crypto.randomUUID();
    setAttempt(key); setSubmitting(true); setError("");
    try {
      setPlaced(await placeCounterOrder(accessToken, scope.organizationId, scope.id, key,
        { items: lines.map(({ variantId, quantity, optionChoiceIds }) => ({ variantId, quantity, optionChoiceIds })) }));
    } catch (failure) {
      if (attempt === undefined && failure instanceof OrderError && failure.status >= 400 && failure.status < 500) {
        setAttempt(undefined); setError("The order was not accepted. Check your access and current menu, then try again.");
      } else setError("The outcome is not yet known. Retry this same order to avoid a duplicate.");
    } finally { setSubmitting(false); }
  }
  if (placed) return <Card><CardHeader><CardTitle><h2>Counter order {placed.publicOrderNumber}</h2></CardTitle></CardHeader>
    <CardContent className="grid gap-4"><p role="status">{placed.status === "COMPLETED" ? "Paid and completed" : placed.status === "CANCELLED" ? "Cancelled" : "Pending"} · {formatMoney(placed.totalMinor, placed.currencyCode)}. {placed.status === "COMPLETED" ? "This order was already completed." : placed.status === "CANCELLED" ? "This order was cancelled. Do not collect payment." : "Collect cash and complete it in the order queue."}</p>
      <Button asChild><Link to="/staff/orders">Open order queue</Link></Button>
      <Button variant="outline" onClick={() => { setPlaced(undefined); setAttempt(undefined); setLines([]); }}>New counter order</Button>
    </CardContent></Card>;
  return <div className="grid gap-5 lg:grid-cols-2">
    <Card><CardHeader><CardTitle><h2>Choose drinks</h2></CardTitle></CardHeader><CardContent className="grid gap-5">
      {loadError ? <ProblemState title="Menu unavailable" message="Reload the current shop menu." actionLabel="Try again" onRetry={() => setReload((n) => n + 1)} />
        : !menu ? <p role="status">Loading menu…</p> : menu.products.every((item) => !item.available) ? <p>No drinks are available at this shop.</p>
        : <><SelectField id="counter-product" label="Drink" disabled={attempt !== undefined} value={productSlug}
          options={menu.products.filter((item) => item.available).map((item) => ({ label: item.name, value: item.slug }))}
          onValueChange={(slug) => { setProduct(undefined); setProductSlug(slug); }} />
          {product && product.slug === productSlug && product.variants.some((item) => item.available)
            ? <CounterDrink key={productSlug} product={product} disabled={attempt !== undefined || lines.length >= 25}
              onAdd={(line) => { setLines((items) => [...items, line]); setError(""); }} /> : product && product.slug === productSlug ? <p>This drink is currently unavailable.</p> : <p role="status">Loading drink options…</p>}</>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle><h2>Counter order</h2></CardTitle></CardHeader><CardContent className="grid gap-4">
      {lines.length === 0 ? <p>Add drinks to begin this counter order.</p> : <ul className="grid gap-3">{lines.map((line, index) => <li className="flex items-center justify-between gap-3" key={index}>
        <span>{line.quantity} × {line.name}<small className="block text-muted-foreground">{formatMoney(line.unitPrice * line.quantity, scope.currency)}</small></span>
        <Button size="compact" variant="outline" disabled={attempt !== undefined} aria-label={`Remove ${line.name}`}
          onClick={() => setLines((items) => items.filter((_, i) => i !== index))}>Remove</Button>
      </li>)}</ul>}
      <p>Preview total: {formatMoney(lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0), scope.currency)}</p>
      <p className="text-sm text-muted-foreground">The server confirms prices. Stock changes only when cash is confirmed and the order is completed.</p>
      {lines.reduce((sum, line) => sum + line.quantity, 0) > 50 ? <p role="alert">An order can contain at most 50 drinks.</p> : null}
      <Button disabled={lines.length === 0 || lines.reduce((sum, line) => sum + line.quantity, 0) > 50} isLoading={submitting} loadingLabel="Recording counter order…" onClick={submit}>
        {attempt ? "Retry same order" : "Place counter order"}</Button>
      <Button variant="outline" disabled={attempt !== undefined} onClick={() => { setLines([]); setError(""); }}>Clear order</Button>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    </CardContent></Card>
  </div>;
}

export default function CounterOrderPage() {
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const [locations, setLocations] = useState<CatalogLocation[]>();
  const [selection, setSelection] = useStaffDraft("counter:selected-location", "");
  const [scopeLocked, setScopeLocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getGuestLocations(controller.signal).then((data) => { if (!controller.signal.aborted) { setLocations(data); setFailed(false); } })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [reload]);
  const scopes: Scope[] = staffContext.memberships.flatMap((member) => member.locations.flatMap((location) => {
    const catalog = locations?.find((item) => item.id === location.id);
    return catalog ? [{ ...catalog, organizationId: member.organizationId }] : [];
  }));
  const scope = scopes.find((item) => item.id === selection) ?? scopes[0];
  useEffect(() => {
    if (scope && selection !== scope.id) setSelection(scope.id);
  }, [scope, selection, setSelection]);
  return <main id="staff-workspace" className="staff-main grid gap-5"><h1>Counter orders</h1>
    <p className="text-muted-foreground">Record walk-in drink orders for your shop.</p>
    {failed ? <ProblemState title="Shops unavailable" message="We could not load your shop menu locations." actionLabel="Try again" onRetry={() => setReload((n) => n + 1)} />
      : !locations ? <p role="status">Loading shops…</p> : !scope ? <p>No assigned shop has a public menu.</p>
      : <><SelectField id="counter-location" label="Shop" disabled={scopeLocked} value={scope.id} options={scopes.map((item) => ({ label: item.name, value: item.id }))}
        onValueChange={setSelection} /><p className="text-xs text-muted-foreground">Clear or finish this order before changing shops.</p>
        <CounterComposer key={scope.id} accessToken={accessToken} scope={scope} onBusyChange={setScopeLocked} /></>}
  </main>;
}
