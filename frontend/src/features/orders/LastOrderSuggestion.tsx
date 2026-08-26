import { useEffect, useState } from "react";

import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { useAuth } from "../auth/useAuth";
import { type CartOrderLine } from "../cart/cartReducer";
import { useCart } from "../cart/CartContext";
import { DrinkArtwork } from "../catalog/DrinkArtwork";
import { formatMoney } from "../catalog/formatMoney";
import type { CatalogProductSummary } from "../catalog/types";
import {
  getLatestCustomerReorder,
  type CustomerReorderLine,
  type CustomerReorderSuggestion,
} from "./customerOrderClient";
import "./customerOrders.css";

type SuggestionState =
  | { status: "hidden" }
  | { status: "error"; accessToken: string; locationSlug: string }
  | {
      status: "ready";
      accessToken: string;
      locationSlug: string;
      suggestion: CustomerReorderSuggestion;
    };

export function LastOrderSuggestion({
  locationSlug,
  products,
}: {
  locationSlug: string;
  products: readonly CatalogProductSummary[];
}) {
  const { isLoading, session } = useAuth();
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<SuggestionState>({ status: "hidden" });
  const accessToken = session?.accessToken ?? "";

  useEffect(() => {
    if (isLoading || accessToken.length === 0) return;

    const controller = new AbortController();
    getLatestCustomerReorder(accessToken, locationSlug, controller.signal)
      .then((suggestion) => setState(suggestion === undefined
        ? { status: "hidden" }
        : { status: "ready", accessToken, locationSlug, suggestion }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error", accessToken, locationSlug });
        }
      });
    return () => controller.abort();
  }, [accessToken, isLoading, locationSlug, retryKey]);

  if (
    isLoading ||
    accessToken.length === 0 ||
    state.status === "hidden" ||
    state.accessToken !== accessToken ||
    state.locationSlug !== locationSlug
  ) return null;

  if (state.status === "error") {
    return (
      <aside className="last-order last-order--error" aria-label="Last order suggestion">
        <p>We couldn’t load your last order.</p>
        <Button onClick={() => setRetryKey((value) => value + 1)} size="compact" variant="secondary">
          Try again
        </Button>
      </aside>
    );
  }

  return <ReorderPicker key={state.suggestion.orderId} products={products} suggestion={state.suggestion} />;
}

function ReorderPicker({
  products,
  suggestion,
}: {
  products: readonly CatalogProductSummary[];
  suggestion: CustomerReorderSuggestion;
}) {
  const { addOrder } = useCart();
  const [selectedIndexes, setSelectedIndexes] = useState(
    () => new Set(suggestion.items.map((_, index) => index)),
  );
  const [cartMessage, setCartMessage] = useState("");
  const selectedItems = suggestion.items.filter((_, index) => selectedIndexes.has(index));
  const selectedQuantity = selectedItems.reduce((total, item) => total + item.quantity, 0);
  const selectedTotal = selectedItems.reduce(
    (total, item) => total + item.unitPriceMinor * item.quantity,
    0,
  );

  function toggleItem(index: number) {
    setSelectedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setCartMessage("");
  }

  function addSelectedItems() {
    const added = addOrder(selectedItems.map((item) => toCartOrderLine(item, suggestion)));
    setCartMessage(added
      ? `Added ${selectedQuantity} ${selectedQuantity === 1 ? "drink" : "drinks"} to your order.`
      : "Your cart can’t fit these drinks. Clear it before trying again.");
  }

  return (
    <section aria-labelledby="last-order-title" className="last-order">
      <div className="last-order__heading">
        <h2 id="last-order-title">Order again</h2>
        <p>Choose favourites from your last order.</p>
      </div>
      <ul aria-label="Drinks from your last order" className="last-order__items">
        {suggestion.items.map((item, index) => {
          const configuration = [
            item.variantName,
            ...item.selections.flatMap((selection) => selection.choiceNames),
          ];
          const product = products.find((candidate) => candidate.slug === item.productSlug);
          return (
            <li key={index}>
              <div className="last-order-item">
                <Checkbox
                  aria-label={`Select ${item.quantity} ${item.productName}, ${configuration.join(", ")}`}
                  checked={selectedIndexes.has(index)}
                  onCheckedChange={() => toggleItem(index)}
                />
                {product === undefined ? null : <DrinkArtwork drink={product} />}
                <div className="last-order-item__copy">
                  <span className="last-order-item__quantity">
                    {item.quantity} {item.quantity === 1 ? "drink" : "drinks"}
                  </span>
                  <h3>{item.productName}</h3>
                  <span>{configuration.join(" · ")}</span>
                  <strong>{formatMoney(item.unitPriceMinor * item.quantity, suggestion.currencyCode)}</strong>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="last-order__footer">
        <p aria-live="polite" className="last-order__message" role="status">{cartMessage}</p>
        <Button disabled={selectedQuantity === 0} onClick={addSelectedItems}>
          {selectedQuantity === 0
            ? "Select drinks to add"
            : `Add ${selectedQuantity} ${selectedQuantity === 1 ? "drink" : "drinks"} · ${formatMoney(selectedTotal, suggestion.currencyCode)}`}
        </Button>
      </div>
    </section>
  );
}

function toCartOrderLine(
  item: CustomerReorderLine,
  suggestion: CustomerReorderSuggestion,
): CartOrderLine {
  return {
    quantity: item.quantity,
    draft: {
      locationSlug: suggestion.location.slug,
      drinkId: item.productSlug,
      drinkName: item.productName,
      configuration: {
        variantId: item.variantId,
        variantName: item.variantName,
        selections: item.selections.map((selection) => ({
          groupId: selection.groupId,
          groupName: selection.groupName,
          choiceIds: [...selection.choiceIds],
          choiceNames: [...selection.choiceNames],
        })),
      },
      unitPriceMinor: item.unitPriceMinor,
      currency: suggestion.currencyCode,
    },
  };
}
