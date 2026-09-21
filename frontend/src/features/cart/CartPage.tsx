import { useEffect, useState } from "react";
import { SelectField } from "../../components/shared";
import { getPaymentMethods } from "./cardClient";
import { useCustomerQuote } from "./useCustomerQuote";
import { ArrowLeft } from "lucide-react";
import { Link, Navigate } from "react-router";

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
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");
  const [cardAvailable, setCardAvailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getPaymentMethods(controller.signal).then((methods) => { if (!controller.signal.aborted) setCardAvailable(methods.card); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const {
    items,
    itemCount,
    previewTotalMinor,
    incrementItem,
    decrementItem,
    removeItem,
    checkoutState,
    checkout: submitCheckout,
  } = useCart();
  const pricing = useCustomerQuote(session?.accessToken, items);
  const quote = checkoutState.attempt ? checkoutState.attempt.quote : pricing.quote;
  const checkoutTotal = quote?.totalMinor ?? previewTotalMinor;
  const submitting = checkoutState.busy;
  const submitError = checkoutState.error;
  const retryKey = checkoutState.attempt?.key;
  const locked = retryKey !== undefined;
  const identityMatches = !checkoutState.attempt?.identity || checkoutState.attempt.identity === session?.userId;
  const placedOrder = !checkoutState.resultIdentity || checkoutState.resultIdentity === session?.userId ? checkoutState.result : undefined;
  const placedLocationSlug = checkoutState.resultSlug;
  const locations = useGuestLocations();
  const pickupLocation = locations.status === "ready"
    ? locations.data.find((location) => location.slug === items[0]?.locationSlug)
    : undefined;
  const menuPath = items[0] === undefined ? "/shop" : `/shop/${items[0].locationSlug}`;

  async function checkout() {
    if (submitting || (items.length === 0 && !retryKey) || (!retryKey && (pricing.loading || pricing.error))) return;
    if (!identityMatches) return;
    await submitCheckout(session, quote, paymentMethod);
  }

  if (checkoutState.attempt?.cardId) return <Navigate replace to={`/card-checkout/${checkoutState.attempt.cardId}`} />;
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
          <p className="mt-2 text-muted-foreground">Check each drink and choose how to pay for pickup.</p>
        </div>
        {checkoutState.attempt?.method === "CARD" ? <Card><CardHeader><CardTitle><h2>Recover your card checkout</h2></CardTitle></CardHeader><CardContent className="grid gap-4">
          <p>The previous card request needs confirmation. Retry it before placing another order.</p>
          {submitError ? <p role="alert">{submitError}</p> : null}
          <Button disabled={!identityMatches} isLoading={submitting} onClick={checkout}>Retry same card checkout</Button>
          {!identityMatches ? <Link to="/account/access">Sign in to the original account</Link> : null}
        </CardContent></Card> : placedOrder !== undefined ? (
          <Card aria-labelledby="confirmation-title" className="mx-auto max-w-2xl">
            <CardHeader><p className="text-xs font-semibold tracking-widest text-primary uppercase">Order confirmed</p><CardTitle><h2 id="confirmation-title">Pickup {placedOrder.publicOrderNumber}</h2></CardTitle></CardHeader>
            <CardContent className="grid gap-5"><p className="text-muted-foreground">{placedOrder.status === "PENDING" ? `Your order is pending. Pay ${formatMoney(placedOrder.totalMinor, placedOrder.currencyCode)} in cash at the shop when it is ready.` : placedOrder.status === "COMPLETED" ? "This order has already been completed and paid." : "This order has been cancelled. No payment is due."}</p>
            <dl className="grid gap-3 rounded-lg bg-muted p-4">
              <div className="flex justify-between gap-4"><dt>Status</dt><dd>{placedOrder.status === "PENDING" ? "Pending" : placedOrder.status === "COMPLETED" ? "Completed" : "Cancelled"}</dd></div>
              <div className="flex justify-between gap-4"><dt>Items</dt><dd>{placedOrder.items.reduce((total, item) => total + item.quantity, 0)}</dd></div>
              {placedOrder.subtotalMinor > placedOrder.totalMinor ? <div className="flex justify-between gap-4"><dt>Favorite discount</dt><dd>−{formatMoney(placedOrder.subtotalMinor - placedOrder.totalMinor, placedOrder.currencyCode)}</dd></div> : null}
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
              {locked ? <Alert><AlertDescription>{identityMatches ? "Recover this order before changing your cart. Items are locked until the shop confirms the outcome." : "Sign in to the original account to recover this order. Your cart is locked to prevent a duplicate."}</AlertDescription></Alert> : null}
              <ul className="grid list-none gap-4 p-0">
                {items.map((item) => (
                  <li key={item.id}>
                    <Card><CardContent className="grid gap-5 pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div><Badge className="mb-2" variant="secondary">Customized drink</Badge><h2 className="text-xl">{item.drinkName}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{configurationSummary(item.configuration)}</p><Button className="mt-3 px-0" disabled={submitting || locked} onClick={() => removeItem(item.id)} size="compact" type="button" variant="link">Remove {item.drinkName}</Button></div>
                      <div className="grid justify-items-start gap-3 sm:justify-items-end"><strong>{formatMoney(item.unitPriceMinor * item.quantity, item.currency)}</strong>
                        <div className="flex items-center gap-2"><Button aria-label={`Decrease ${item.drinkName} quantity`} className="w-11 px-0" disabled={submitting || locked} onClick={() => decrementItem(item.id)} type="button" variant="outline">−</Button><span aria-live="polite" className="min-w-20 text-center text-sm">Quantity {item.quantity}</span><Button aria-label={`Increase ${item.drinkName} quantity`} className="w-11 px-0" disabled={submitting || locked || item.quantity >= MAX_LINE_QUANTITY || itemCount >= MAX_ORDER_QUANTITY} onClick={() => incrementItem(item.id)} type="button" variant="outline">+</Button></div>
                      </div>
                    </CardContent></Card>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-4" variant="ghost"><Link to={`/shop/${items[0].locationSlug}`}>← Add another drink</Link></Button>
            </section>
            <Card className="h-fit lg:sticky lg:top-24" aria-labelledby="summary-title">
              <CardHeader><p className="text-xs font-semibold tracking-widest text-primary uppercase">Pickup payment</p><CardTitle><h2 id="summary-title">{paymentMethod === "CARD" ? "Pay online" : "Pay at the shop"}</h2></CardTitle><p className="text-sm leading-6 text-muted-foreground">{paymentMethod === "CARD" ? "Reserve your drinks, then pay securely on Stripe." : "Review the total, place the order, then pay cash when you pick it up."}</p></CardHeader>
              <CardContent><div className="mb-4"><SelectField id="checkout-method" label="Payment method" value={paymentMethod} disabled={locked || submitting}
                options={[{ value: "CASH", label: "Cash at pickup" }, ...(cardAvailable ? [{ value: "CARD", label: "Online card payment" }] : [])]}
                onValueChange={(value) => setPaymentMethod(value === "CARD" ? "CARD" : "CASH")} />
                {!cardAvailable ? <p className="mt-2 text-sm text-muted-foreground">Online card payments are not currently enabled.</p> : null}</div><dl className="grid gap-3">
                <div className="flex justify-between gap-4"><dt>Pickup at</dt><dd className="text-right font-medium">{pickupLocation?.name ?? locationNameFromSlug(items[0]?.locationSlug)}</dd></div>
                <div className="flex justify-between gap-4"><dt>Items</dt><dd>{itemCount}</dd></div>
                {quote && quote.discountMinor > 0 ? <div className="flex justify-between gap-4"><dt>Favorite discount</dt><dd>−{formatMoney(quote.discountMinor, quote.currencyCode)}</dd></div> : null}
                <div className="flex justify-between gap-4 border-t pt-3 text-lg font-semibold"><dt>Preview total</dt><dd>{pricing.loading && !locked ? "Calculating…" : formatMoney(checkoutTotal, items[0].currency)}</dd></div>
              </dl></CardContent>
              <CardFooter className="grid gap-3"><Button aria-describedby="checkout-note" className="w-full" disabled={!identityMatches || (!retryKey && (pricing.loading || pricing.error))} isLoading={submitting} loadingLabel="Placing order…" onClick={checkout} type="button">{`${paymentMethod === "CARD" ? "Continue to card payment" : "Place order"} · ${formatMoney(checkoutTotal, items[0].currency)}`}</Button>{pricing.error && !locked ? <div role="alert">Current prices could not be loaded. <Button variant="outline" onClick={pricing.retry}>Refresh prices</Button></div> : null}<small className="text-muted-foreground" id="checkout-note">{paymentMethod === "CARD" ? "Your ingredients are held until payment completes or the checkout is cancelled." : "This sends a pending order to the shop. Pay cash at pickup."}</small>{submitError === undefined ? null : <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>}</CardFooter>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
