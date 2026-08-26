import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { formatMoney } from "../catalog/formatMoney";
import type { DrinkConfiguration } from "../catalog/pricing";
import { useGuestLocations } from "../catalog/useGuestCatalog";
import { useAuth } from "../auth/useAuth";
import { useCart } from "./CartContext";
import { MAX_LINE_QUANTITY, MAX_ORDER_QUANTITY } from "./cartReducer";
import { OrderError, placeGuestOrder, type GuestOrder } from "./orderClient";

function locationNameFromSlug(slug: string | undefined) {
  if (slug === undefined) return "Pickup shop";
  return slug.split("-").map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
}

function configurationSummary(configuration: DrinkConfiguration) {
  const choices = configuration.selections.map((selection) => (
    selection.choiceNames.length > 0
      ? selection.choiceNames.join(", ")
      : `No ${selection.groupName.toLowerCase()}`
  ));
  return [configuration.variantName, ...choices].join(" · ");
}

export function CartPage() {
  const { session } = useAuth();
  const {
    items,
    itemCount,
    previewTotalMinor,
    incrementItem,
    decrementItem,
    removeItem,
    clearCart,
  } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [placedOrder, setPlacedOrder] = useState<GuestOrder>();
  const [placedLocationSlug, setPlacedLocationSlug] = useState<string>();
  const retryKey = useRef<string | undefined>(undefined);
  const locations = useGuestLocations();
  const pickupLocation = locations.status === "ready"
    ? locations.data.find((location) => location.slug === items[0]?.locationSlug)
    : undefined;
  const menuPath = items[0] === undefined ? "/shop" : `/shop/${items[0].locationSlug}`;

  useEffect(() => {
    retryKey.current = undefined;
  }, [items]);

  async function checkout() {
    if (submitting || items.length === 0) return;
    setSubmitting(true);
    setSubmitError(undefined);
    const key = retryKey.current ?? crypto.randomUUID();
    retryKey.current = key;
    try {
      const order = await placeGuestOrder({
        items: items.map((item) => ({
          variantId: item.configuration.variantId,
          quantity: item.quantity,
          optionChoiceIds: item.configuration.selections.flatMap((selection) => selection.choiceIds),
        })),
      }, key, session?.accessToken, items[0].locationSlug);
      retryKey.current = undefined;
      setPlacedLocationSlug(items[0].locationSlug);
      setPlacedOrder(order);
      clearCart();
    } catch (error) {
      if (error instanceof OrderError) {
        retryKey.current = undefined;
        if (error.code === "ORDER_CATALOG_CHANGED") {
          setSubmitError("The menu changed while you were ordering. Review the current menu and update this order before trying again.");
        } else if (error.code === "CUSTOMER_ACCOUNT_DISABLED") {
          setSubmitError("Your signed-in account is unavailable. Sign out or contact the shop before trying again.");
        } else if (error.code === "ORDER_INVALID" || error.code === "ORDER_IDEMPOTENCY_CONFLICT") {
          setSubmitError("This order could not be submitted safely. Review it and try again.");
        } else {
          setSubmitError("Ordering is temporarily unavailable. Your order is still here; try again shortly.");
        }
      } else {
        setSubmitError("We couldn’t confirm whether the order reached the shop. Your order is still here; retry to check safely without creating a duplicate.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="customer-shell">
      <a className="skip-link" href="#cart-title">Skip to current order</a>
      <CustomerHeader itemCount={itemCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="cart-title">
        <div className="mb-8 border-b pb-6">
          <Button asChild className="mb-4 -ml-3 w-fit" size="compact" variant="ghost">
            <Link to={menuPath}><ArrowLeft aria-hidden="true" /> Back to menu</Link>
          </Button>
          <p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">Order review</p>
          <h1 className="text-3xl" id="cart-title">Your current order</h1>
          <p className="mt-2 text-muted-foreground">Check each drink, then place the order for cash pickup.</p>
        </div>
        {placedOrder !== undefined ? (
          <Card aria-labelledby="confirmation-title" className="mx-auto max-w-2xl">
            <CardHeader><p className="text-xs font-semibold tracking-widest text-primary uppercase">Order confirmed</p><CardTitle><h2 id="confirmation-title">Pickup {placedOrder.publicOrderNumber}</h2></CardTitle></CardHeader>
            <CardContent className="grid gap-5"><p className="text-muted-foreground">Your order is pending. Pay {formatMoney(placedOrder.totalMinor, placedOrder.currencyCode)} in cash at the shop when it is ready.</p>
            <dl className="grid gap-3 rounded-lg bg-muted p-4">
              <div className="flex justify-between gap-4"><dt>Status</dt><dd>Pending</dd></div>
              <div className="flex justify-between gap-4"><dt>Items</dt><dd>{placedOrder.items.reduce((total, item) => total + item.quantity, 0)}</dd></div>
              <div className="flex justify-between gap-4 font-semibold"><dt>Confirmed total</dt><dd>{formatMoney(placedOrder.totalMinor, placedOrder.currencyCode)}</dd></div>
            </dl>
            <Button asChild variant="outline"><Link to={placedLocationSlug === undefined ? "/shop" : `/shop/${placedLocationSlug}`}>Start another order</Link></Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card aria-labelledby="empty-title" className="mx-auto max-w-2xl text-center"><CardHeader><CardTitle><h2 id="empty-title">Your order is empty</h2></CardTitle></CardHeader><CardContent className="grid justify-items-center gap-5"><p className="text-muted-foreground">Choose a drink and customize it to get started.</p><Button asChild variant="outline"><Link to="/shop">Browse the menu</Link></Button></CardContent></Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section aria-label="Order items">
              <ul className="grid list-none gap-4 p-0">
                {items.map((item) => (
                  <li key={item.id}>
                    <Card><CardContent className="grid gap-5 pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div><Badge className="mb-2" variant="secondary">Customized drink</Badge><h2 className="text-xl">{item.drinkName}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{configurationSummary(item.configuration)}</p><Button className="mt-3 px-0" disabled={submitting} onClick={() => removeItem(item.id)} size="compact" type="button" variant="link">Remove {item.drinkName}</Button></div>
                      <div className="grid justify-items-start gap-3 sm:justify-items-end"><strong>{formatMoney(item.unitPriceMinor * item.quantity, item.currency)}</strong>
                        <div className="flex items-center gap-2"><Button aria-label={`Decrease ${item.drinkName} quantity`} className="w-11 px-0" disabled={submitting} onClick={() => decrementItem(item.id)} type="button" variant="outline">−</Button><span aria-live="polite" className="min-w-20 text-center text-sm">Quantity {item.quantity}</span><Button aria-label={`Increase ${item.drinkName} quantity`} className="w-11 px-0" disabled={submitting || item.quantity >= MAX_LINE_QUANTITY || itemCount >= MAX_ORDER_QUANTITY} onClick={() => incrementItem(item.id)} type="button" variant="outline">+</Button></div>
                      </div>
                    </CardContent></Card>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-4" variant="ghost"><Link to={`/shop/${items[0].locationSlug}`}>← Add another drink</Link></Button>
            </section>
            <Card className="h-fit lg:sticky lg:top-24" aria-labelledby="summary-title">
              <CardHeader><p className="text-xs font-semibold tracking-widest text-primary uppercase">Cash pickup</p><CardTitle><h2 id="summary-title">Pay at the shop</h2></CardTitle><p className="text-sm leading-6 text-muted-foreground">Review the total, place the order, then pay cash when you pick it up.</p></CardHeader>
              <CardContent><dl className="grid gap-3">
                <div className="flex justify-between gap-4"><dt>Pickup at</dt><dd className="text-right font-medium">{pickupLocation?.name ?? locationNameFromSlug(items[0]?.locationSlug)}</dd></div>
                <div className="flex justify-between gap-4"><dt>Items</dt><dd>{itemCount}</dd></div>
                <div className="flex justify-between gap-4 border-t pt-3 text-lg font-semibold"><dt>Preview total</dt><dd>{formatMoney(previewTotalMinor, items[0].currency)}</dd></div>
              </dl></CardContent>
              <CardFooter className="grid gap-3"><Button aria-describedby="checkout-note" className="w-full" isLoading={submitting} loadingLabel="Placing order…" onClick={checkout} type="button">{`Place order · ${formatMoney(previewTotalMinor, items[0].currency)}`}</Button><small className="text-muted-foreground" id="checkout-note">This sends a pending order to the shop. Pay cash at pickup.</small>{submitError === undefined ? null : <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>}</CardFooter>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
