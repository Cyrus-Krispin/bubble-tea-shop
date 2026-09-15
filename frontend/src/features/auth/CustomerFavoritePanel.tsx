import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ProblemState, SelectField } from "../../components/shared";
import { useGuestLocations } from "../catalog/useGuestCatalog";
import { getFavorite, saveFavorite, type Favorite } from "./favoriteClient";

function FavoriteSelection({ token, slug }: { token: string; slug: string }) {
  const generation = useRef(0);
  const [state, setState] = useState<{ data?: Favorite; failed?: boolean }>({});
  const [selection, setSelection] = useState(""); const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const readGeneration = ++generation.current;
    getFavorite(token, slug, controller.signal).then((data) => {
      if (!controller.signal.aborted && generation.current === readGeneration) { setState({ data }); setSelection(data.recipeId ?? ""); }
    }).catch(() => { if (!controller.signal.aborted && generation.current === readGeneration) setState({ failed: true }); });
    return () => controller.abort();
  }, [token, slug, reload]);
  async function save(recipeId: string | null) {
    if (busy) return; generation.current += 1; setBusy(true); setMessage("");
    try { const data = await saveFavorite(token, slug, recipeId); setState({ data }); setSelection(data.recipeId ?? ""); setMessage(recipeId ? "Favorite saved." : "Favorite removed."); }
    catch { setMessage("We could not confirm this change. Refresh your favorite before trying again."); }
    finally { setBusy(false); }
  }
  if (state.failed) return <ProblemState title="Favorite unavailable" message="We could not load your favorite for this shop." actionLabel="Try again" onRetry={() => setReload((n) => n + 1)} />;
  if (!state.data) return <p role="status">Loading favorite…</p>;
  const data = state.data;
  return <div className="grid gap-4"><p>Save one favorite recipe for this shop organization. Get {data.discountPercent}% off one matching base drink per order, excluding add-ons.</p>
    <p>{data.recipeId ? `Current favorite: ${data.recipeName}` : "You have not chosen a favorite yet."}</p>
    {data.recipeId && !data.recipes.some((recipe) => recipe.id === data.recipeId) ? <p>Your saved recipe is currently unavailable at this shop.</p> : null}
    {data.recipes.length === 0 ? <p>No recipes are available to choose at this shop.</p> : <SelectField id="favorite-recipe" label="Favorite recipe" value={data.recipes.some((recipe) => recipe.id === selection) ? selection : ""}
      options={data.recipes.map((recipe) => ({ value: recipe.id, label: recipe.name }))} onValueChange={setSelection} disabled={busy} />}
    <div className="flex flex-wrap gap-3"><Button isLoading={busy} disabled={!selection || !data.recipes.some((recipe) => recipe.id === selection)} onClick={() => save(selection)}>Save favorite</Button>
      <Button variant="outline" disabled={busy || data.recipeId === null} onClick={() => save(null)}>Remove favorite</Button>
      <Button variant="ghost" disabled={busy} onClick={() => setReload((n) => n + 1)}>Refresh favorite</Button></div>
    {message ? <p role="status">{message}</p> : null}
  </div>;
}

export function CustomerFavoritePanel({ accessToken }: { accessToken: string }) {
  const locations = useGuestLocations(); const [selected, setSelected] = useState("");
  const shop = locations.status === "ready" ? locations.data.find((location) => location.slug === selected) ?? locations.data[0] : undefined;
  return <Card><CardHeader><CardTitle><h2>Your favorite drink</h2></CardTitle></CardHeader><CardContent className="grid gap-4">
    {locations.status === "error" ? <p role="status">Shop locations could not be loaded. Reload this page to try again.</p>
      : !shop ? <p role="status">{locations.status === "ready" ? "No shops are available." : "Loading shops…"}</p> : <>
      <SelectField id="favorite-shop" label="Favorite shop" value={shop.slug} options={locations.status === "ready" ? locations.data.map((location) => ({ value: location.slug, label: location.name })) : []} onValueChange={setSelected} />
      <FavoriteSelection key={`${accessToken}:${shop.slug}`} token={accessToken} slug={shop.slug} />
    </>}
  </CardContent></Card>;
}
