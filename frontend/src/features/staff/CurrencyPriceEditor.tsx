import { useEffect, useState } from "react";
import { Field, SelectField } from "../../components/shared";
import { Button } from "../../components/ui/button";
import { getCurrencyPrices, saveCurrencyPrices, type CurrencyPriceSet } from "./currencyClient";

export function CurrencyPriceEditor({ token, organizationId, variantId, onChanged }: { token: string; organizationId: string; variantId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false); const [currency, setCurrency] = useState("SGD");
  return <section className="grid gap-4 border-t pt-4"><Button variant="outline" onClick={() => setOpen(!open)}>{open ? "Hide currency prices" : "Set currency prices"}</Button>
    {open ? <><SelectField id={`price-currency-${variantId}`} label="Price currency" value={currency} options={["SGD", "MYR", "CNY"].map((value) => ({ value, label: value }))} onValueChange={setCurrency} />
      <PriceForm key={`${token}:${variantId}:${currency}`} token={token} org={organizationId} variant={variantId} currency={currency} onChanged={onChanged} /></> : null}
  </section>;
}
function PriceForm({ token, org, variant, currency, onChanged }: { token: string; org: string; variant: string; currency: string; onChanged: () => void }) {
  const [data, setData] = useState<CurrencyPriceSet>(); const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false); const [reload, setReload] = useState(0);
  useEffect(() => { const controller = new AbortController();
    getCurrencyPrices(token, org, variant, currency, controller.signal).then((result) => { if (!controller.signal.aborted) { setData(result); setValues(Object.fromEntries(result.choices.map((choice) => [choice.linkId, choice.priceDeltaMinor === null ? "" : (choice.priceDeltaMinor / 100).toFixed(2)]))); setError(""); } })
      .catch((error) => { if (!controller.signal.aborted) setError(error.message); }); return () => controller.abort();
  }, [token, org, variant, currency, reload]);
  return <form className="grid gap-4" onSubmit={async (event) => { event.preventDefault(); if (!data || busy) return; setBusy(true); setError(""); setSaved(false);
    try { const next = await saveCurrencyPrices(token, org, data, values); setData(next); setSaved(true); onChanged(); } catch (error) { setError(error instanceof Error ? error.message : "Could not save prices."); } finally { setBusy(false); }
  }}><p>Enter the add-on price in {currency} for every choice, including zero. Prices are entered separately for each currency. A shop cannot sell this variant until all its choice prices are set.</p>
    {data?.choices.map((choice) => <Field key={choice.linkId} id={`currency-price-${variant}-${choice.linkId}`} label={`${choice.groupName} · ${choice.choiceName} (${currency})`}><input required inputMode="decimal" value={values[choice.linkId] ?? ""} disabled={busy} onChange={(event) => setValues({ ...values, [choice.linkId]: event.target.value })} /></Field>)}
    {data?.choices.length === 0 ? <p>This variant has no enabled choices. Set its base price in the shop offering.</p> : null}
    {error ? <p role="alert">{error}</p> : null}{saved ? <p role="status">Currency prices saved.</p> : null}
    <div className="flex flex-wrap gap-3"><Button type="submit" isLoading={busy} disabled={!data || data.choices.length === 0}>Save currency prices</Button><Button variant="outline" type="button" disabled={busy} onClick={() => { setData(undefined); setReload((n) => n + 1); }}>Reload prices</Button></div>
  </form>;
}
