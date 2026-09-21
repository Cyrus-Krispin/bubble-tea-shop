import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { Field, SelectField } from "../../components/shared";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import type { StaffOutletContext } from "./StaffLayout";
import { createOwnerLocation, getOwnerLocations, type OwnerShopLocation } from "./currencyClient";

export default function OwnerLocationsPage() {
  const { accessToken, staffContext, refreshAccess } = useOutletContext<StaffOutletContext>();
  const owners = staffContext.memberships.filter((membership) => membership.role === "OWNER");
  const [selected, setSelected] = useState(""); const org = owners.find((owner) => owner.organizationId === selected) ?? owners[0];
  return <main className="staff-main grid gap-6" id="staff-workspace"><h1>Shop locations</h1>
    {!org ? <p>Only shop owners can create locations.</p> : <><SelectField id="locations-org" label="Organization" value={org.organizationId} options={owners.map((owner) => ({ value: owner.organizationId, label: owner.organizationName }))} onValueChange={setSelected} />
      <LocationForm key={`${accessToken}:${org.organizationId}`} token={accessToken} org={org.organizationId} onCreated={() => refreshAccess?.()} /></>}
  </main>;
}
function LocationForm({ token, org, onCreated }: { token: string; org: string; onCreated: () => void }) {
  const [locations, setLocations] = useState<OwnerShopLocation[]>(); const [reload, setReload] = useState(0);
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [currency, setCurrency] = useState("SGD");
  const [timezone, setTimezone] = useState("Asia/Singapore"); const [locale, setLocale] = useState("en-SG");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  useEffect(() => { const controller = new AbortController(); getOwnerLocations(token, org, controller.signal)
    .then((items) => { if (!controller.signal.aborted) setLocations(items); }).catch((error) => { if (!controller.signal.aborted) setError(error.message); }); return () => controller.abort(); }, [token, org, reload]);
  return <><Card><CardHeader><CardTitle><h2>Current shops</h2></CardTitle></CardHeader><CardContent className="grid gap-3">
    {!locations ? <p>Loading shops…</p> : locations.map((shop) => <div className="border-b pb-3" key={shop.id}><strong>{shop.name}</strong><p>{shop.currencyCode} · {shop.timezone} · {shop.defaultLocale} · {shop.active ? "Active" : "Inactive"}</p><p>{shop.slug ? `/shop/${shop.slug}` : "No public menu"}</p></div>)}
    <Button variant="outline" disabled={busy} onClick={() => { setLocations(undefined); setReload((n) => n + 1); }}>Refresh shops</Button></CardContent></Card>
    <Card><CardHeader><CardTitle><h2>Add shop</h2></CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={async (event) => { event.preventDefault(); if (busy) return; setBusy(true); setError(""); setSuccess("");
      try { const shop = await createOwnerLocation(token, org, { name, slug, currencyCode: currency, timezone, defaultLocale: locale }); setLocations((items) => [...(items ?? []), shop]); setSuccess(`${shop.name} created. Configure its menu offerings, currency option prices and opening inventory before accepting orders.`); setName(""); setSlug(""); onCreated(); } catch (error) { setError(error instanceof Error ? error.message : "Could not create shop."); } finally { setBusy(false); }
    }}><p>Each shop settles in one currency. This choice is permanent; existing money records are never converted.</p>
      <Field id="shop-name" label="Shop name"><input required maxLength={160} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} /></Field>
      <Field id="shop-slug" label="Public shop URL" description="Lowercase letters, numbers and hyphens; for example, kuala-lumpur-central."><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} value={slug} disabled={busy} onChange={(e) => setSlug(e.target.value)} /></Field>
      <SelectField id="shop-currency" label="Settlement currency" value={currency} options={["SGD", "MYR", "CNY"].map((value) => ({ value, label: value }))} onValueChange={setCurrency} disabled={busy} />
      <SelectField id="shop-timezone" label="Shop timezone" value={timezone} options={["Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Shanghai"].map((value) => ({ value, label: value }))} onValueChange={setTimezone} disabled={busy} />
      <SelectField id="shop-locale" label="Default language" value={locale} options={[{ value: "en-SG", label: "English" }, { value: "ms-MY", label: "Malay" }, { value: "zh-CN", label: "Chinese (Simplified)" }]} onValueChange={setLocale} disabled={busy} />
      <Button type="submit" disabled={!locations} isLoading={busy}>Create shop</Button></form></CardContent></Card>
    {error ? <p role="alert">{error}</p> : null}{success ? <p role="status">{success}</p> : null}
  </>;
}
