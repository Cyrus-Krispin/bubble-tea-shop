import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { useCart } from "../cart/CartContext";
import { findDemoDrink } from "./demoCatalog";
import { DrinkArtwork } from "./DrinkArtwork";
import { formatMoney } from "./formatMoney";
import {
  calculatePreviewTotal,
  defaultConfiguration,
  iceOptions,
  sizeOptions,
  sweetnessOptions,
  toppingOptions,
  type DrinkConfiguration,
} from "./pricing";

function priceDeltaLabel(priceDeltaMinor: number) {
  if (priceDeltaMinor === 0) return "Included";
  return `${priceDeltaMinor > 0 ? "+" : "−"}${formatMoney(Math.abs(priceDeltaMinor))}`;
}

export function DrinkPage() {
  const { drinkId } = useParams();
  const drink = findDemoDrink(drinkId);
  const { addItem, itemCount } = useCart();
  const [configuration, setConfiguration] = useState<DrinkConfiguration>(() => ({
    ...defaultConfiguration,
    toppingIds: [],
  }));
  const [addedMessage, setAddedMessage] = useState("");

  if (!drink || !drink.available) {
    return (
      <div className="customer-shell">
        <CustomerHeader itemCount={itemCount} />
        <main className="not-found" aria-labelledby="missing-drink-title">
          <p className="eyebrow">Menu update</p>
          <h1 id="missing-drink-title">We couldn&apos;t find that drink</h1>
          <p>It may be unavailable today or the menu link may have changed.</p>
          <Link className="secondary-link" to="/shop">Return to menu</Link>
        </main>
      </div>
    );
  }

  const availableDrink = drink;
  const previewTotalMinor = calculatePreviewTotal(availableDrink, configuration);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addItem({
      drinkId: availableDrink.id,
      drinkName: availableDrink.name,
      configuration,
      unitPriceMinor: previewTotalMinor,
    });
    setAddedMessage(`Added ${availableDrink.name} to your order.`);
  }

  function toggleTopping(toppingId: DrinkConfiguration["toppingIds"][number]) {
    setConfiguration((current) => ({
      ...current,
      toppingIds: current.toppingIds.includes(toppingId)
        ? current.toppingIds.filter((id) => id !== toppingId)
        : [...current.toppingIds, toppingId],
    }));
    setAddedMessage("");
  }

  function selectChoice(choice: Partial<DrinkConfiguration>) {
    setConfiguration((current) => ({ ...current, ...choice }));
    setAddedMessage("");
  }

  return (
    <div className="customer-shell">
      <a className="skip-link" href="#customize-title">Skip to customization</a>
      <CustomerHeader itemCount={itemCount} />
      <main className="customize-layout">
        <section className="drink-feature" aria-labelledby="drink-name">
          <Link className="back-link" to="/shop">← Back to menu</Link>
          <DrinkArtwork drink={drink} />
          <p className="product-category">{drink.category}</p>
          <h1 id="drink-name">{drink.name}</h1>
          <p>{drink.description}</p>
        </section>
        <form className="customizer" onSubmit={submit}>
          <div className="customizer-heading">
            <div><p className="eyebrow">One cup at a time</p><h2 id="customize-title">Make it yours</h2></div>
            <strong aria-live="polite">{formatMoney(previewTotalMinor)}</strong>
          </div>
          <fieldset>
            <legend>Size</legend>
            <div className="option-row option-row--three">
              {sizeOptions.map((option) => (
                <label key={option.id}>
                  <input aria-label={`${option.label} ${priceDeltaLabel(option.priceDeltaMinor)}`} checked={configuration.size === option.id} name="size" onChange={() => selectChoice({ size: option.id })} type="radio" />
                  <span>{option.label}</span><small>{priceDeltaLabel(option.priceDeltaMinor)}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Sweetness</legend>
            <div className="option-row option-row--five">
              {sweetnessOptions.map((option) => (
                <label key={option}><input checked={configuration.sweetness === option} name="sweetness" onChange={() => selectChoice({ sweetness: option })} type="radio" /><span>{option}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Ice</legend>
            <div className="option-row option-row--four">
              {iceOptions.map((option) => (
                <label key={option}><input checked={configuration.ice === option} name="ice" onChange={() => selectChoice({ ice: option })} type="radio" /><span>{option}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Toppings <small>Optional</small></legend>
            <div className="topping-row">
              {toppingOptions.map((option) => (
                <label key={option.id}>
                  <input aria-label={`${option.label} ${priceDeltaLabel(option.priceDeltaMinor)}`} checked={configuration.toppingIds.includes(option.id)} onChange={() => toggleTopping(option.id)} type="checkbox" />
                  <span aria-hidden="true" className={`topping-icon topping-icon--${option.id}`}>●</span>
                  <strong>{option.label}</strong><small>{priceDeltaLabel(option.priceDeltaMinor)}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="customizer-action">
            <p className="preview-disclaimer">Preview total · Final availability and price are confirmed by the shop.</p>
            <button type="submit">Add to order · {formatMoney(previewTotalMinor)}</button>
          </div>
          {addedMessage ? <p className="added-message" role="status">✓ {addedMessage} <Link to="/cart">View order</Link></p> : null}
        </form>
      </main>
    </div>
  );
}
