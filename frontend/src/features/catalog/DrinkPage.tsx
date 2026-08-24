import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { ProblemState } from "../../components/ui";
import { useCart } from "../cart/CartContext";
import { DrinkArtwork } from "./DrinkArtwork";
import { formatMoney } from "./formatMoney";
import {
  calculatePreviewTotal,
  configurationForVariant,
  createDefaultConfiguration,
  type DrinkConfiguration,
} from "./pricing";
import type { CatalogOptionChoice, CatalogOptionGroup, CatalogProduct } from "./types";
import { useGuestProduct } from "./useGuestCatalog";

function priceDeltaLabel(priceDeltaMinor: number, currency: string) {
  if (priceDeltaMinor === 0) return "Included";
  return `${priceDeltaMinor > 0 ? "+" : "−"}${formatMoney(Math.abs(priceDeltaMinor), currency)}`;
}

export function DrinkPage() {
  const { drinkId, locationSlug } = useParams();
  const { itemCount } = useCart();
  const { state, retry } = useGuestProduct(drinkId, locationSlug);

  if (state.status === "loading") {
    return <DrinkStatus itemCount={itemCount} locationSlug={locationSlug} message="Loading drink options…" />;
  }
  if (state.status === "error" || !state.data.variants.some((variant) => variant.available)) {
    return (
      <DrinkStatus
        itemCount={itemCount}
        locationSlug={locationSlug}
        message="We couldn’t find that drink or load its current options."
        retry={retry}
      />
    );
  }
  return <DrinkCustomizer key={`${locationSlug ?? "default"}-${state.data.id}`} locationSlug={locationSlug} product={state.data} />;
}

function DrinkCustomizer({ locationSlug, product }: { locationSlug?: string; product: CatalogProduct }) {
  const { addItem, itemCount, locationSlug: cartLocationSlug } = useCart();
  const [configuration, setConfiguration] = useState<DrinkConfiguration>(() => (
    createDefaultConfiguration(product)
  ));
  const [addedMessage, setAddedMessage] = useState("");
  const variant = product.variants.find((candidate) => candidate.id === configuration.variantId);
  if (!variant) throw new Error("selected catalog variant is missing");
  const currency = variant.price.currency;
  const previewTotalMinor = calculatePreviewTotal(product, configuration);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locationSlug === undefined) {
      setAddedMessage("Choose a shop before adding this drink to your order.");
      return;
    }
    const pickupLocation = locationSlug;
    if (cartLocationSlug !== undefined && cartLocationSlug !== pickupLocation) {
      setAddedMessage("Your current order is for another shop. Complete or clear it before adding this drink.");
      return;
    }
    addItem({
      locationSlug: pickupLocation,
      drinkId: product.slug,
      drinkName: product.name,
      configuration,
      unitPriceMinor: previewTotalMinor,
      currency,
    });
    setAddedMessage(`Added ${product.name} to your order.`);
  }

  function selectVariant(variantId: string) {
    const nextVariant = product.variants.find((candidate) => candidate.id === variantId && candidate.available);
    if (!nextVariant) return;
    setConfiguration(configurationForVariant(nextVariant));
    setAddedMessage("");
  }

  function selectChoice(group: CatalogOptionGroup, choice: CatalogOptionChoice) {
    setConfiguration((current) => ({
      ...current,
      selections: current.selections.map((selection) => {
        if (selection.groupId !== group.id) return selection;
        const selected = selection.choiceIds.includes(choice.id);
        const choiceIds = group.maximumSelections === 1
          ? [choice.id]
          : selected
            ? selection.choiceIds.filter((id) => id !== choice.id)
            : [...selection.choiceIds, choice.id].slice(0, group.maximumSelections);
        return {
          ...selection,
          choiceIds,
          choiceNames: group.choices
            .filter((candidate) => choiceIds.includes(candidate.id))
            .map((candidate) => candidate.name),
        };
      }),
    }));
    setAddedMessage("");
  }

  return (
    <div className="customer-shell">
      <a className="skip-link" href="#customize-title">Skip to customization</a>
      <CustomerHeader itemCount={itemCount} />
      <main className="customize-layout">
        <section className="drink-feature" aria-labelledby="drink-name">
          <Link className="back-link" to={locationSlug === undefined ? "/shop" : `/shop/${locationSlug}`}>← Back to menu</Link>
          <DrinkArtwork drink={product} priority />
          <p className="product-category">{product.category}</p>
          <h1 id="drink-name">{product.name}</h1>
          <p>{product.description}</p>
        </section>
        <form className="customizer" onSubmit={submit}>
          <div className="customizer-heading">
            <div><p className="eyebrow">One cup at a time</p><h2 id="customize-title">Make it yours</h2></div>
            <strong aria-live="polite">{formatMoney(previewTotalMinor, currency)}</strong>
          </div>
          <fieldset>
            <legend>Size</legend>
            <div className="option-row option-row--three">
              {product.variants.map((option) => {
                const defaultPrice = product.variants.find((candidate) => candidate.isDefault)?.price.amountMinor
                  ?? variant.price.amountMinor;
                const delta = option.price.amountMinor - defaultPrice;
                return (
                  <label key={option.id}>
                    <input
                      aria-label={`${option.name} ${priceDeltaLabel(delta, option.price.currency)}`}
                      checked={configuration.variantId === option.id}
                      disabled={!option.available}
                      name="size"
                      onChange={() => selectVariant(option.id)}
                      type="radio"
                    />
                    <span>{option.name}</span><small>{option.available ? priceDeltaLabel(delta, option.price.currency) : "Unavailable"}</small>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {variant.optionGroups.map((group) => (
            <OptionGroup
              configuration={configuration}
              group={group}
              key={group.id}
              onSelect={selectChoice}
            />
          ))}
          <div className="customizer-action">
            <p className="preview-disclaimer">Current menu total · Final price is confirmed when the order is submitted.</p>
            <button type="submit">Add to order · {formatMoney(previewTotalMinor, currency)}</button>
          </div>
          {addedMessage ? <p className="added-message" role="status">✓ {addedMessage} <Link to="/cart">View order</Link></p> : null}
        </form>
      </main>
    </div>
  );
}

function OptionGroup({
  configuration,
  group,
  onSelect,
}: {
  configuration: DrinkConfiguration;
  group: CatalogOptionGroup;
  onSelect: (group: CatalogOptionGroup, choice: CatalogOptionChoice) => void;
}) {
  const selection = configuration.selections.find((candidate) => candidate.groupId === group.id);
  const selectedIds = selection?.choiceIds ?? [];
  const multiple = group.maximumSelections > 1;
  const rowClass = multiple ? "topping-row" : `option-row option-row--${Math.min(group.choices.length, 5)}`;

  return (
    <fieldset>
      <legend>{group.name} {group.minimumSelections === 0 ? <small>Optional</small> : null}</legend>
      <div className={rowClass}>
        {group.choices.map((choice) => {
          const selected = selectedIds.includes(choice.id);
          const limitReached = multiple && !selected && selectedIds.length >= group.maximumSelections;
          return (
            <label key={choice.id}>
              <input
                aria-label={`${choice.name} ${priceDeltaLabel(choice.priceDelta.amountMinor, choice.priceDelta.currency)}`}
                checked={selected}
                disabled={limitReached}
                name={multiple ? undefined : group.id}
                onChange={() => onSelect(group, choice)}
                type={multiple ? "checkbox" : "radio"}
              />
              {multiple ? <span aria-hidden="true" className="topping-icon">●</span> : null}
              {multiple ? <strong>{choice.name}</strong> : <span>{choice.name}</span>}
              <small>{priceDeltaLabel(choice.priceDelta.amountMinor, choice.priceDelta.currency)}</small>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function DrinkStatus({
  itemCount,
  locationSlug,
  message,
  retry,
}: {
  itemCount: number;
  locationSlug?: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="customer-shell">
      <CustomerHeader itemCount={itemCount} />
      <main aria-label="Drink status" className="not-found">
        {retry === undefined ? (
          <>
            <p className="eyebrow">Menu update</p>
            <h1>{message}</h1>
          </>
        ) : (
          <ProblemState
            message="Try again or return to the menu."
            onRetry={retry}
            title={message}
          />
        )}
        <Link className="secondary-link" to={locationSlug === undefined ? "/shop" : `/shop/${locationSlug}`}>Return to menu</Link>
      </main>
    </div>
  );
}
