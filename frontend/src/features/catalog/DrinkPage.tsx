import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { ProblemState } from "../../components/shared";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Separator } from "../../components/ui/separator";
import { cn } from "../../lib/utils";
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
      <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(32rem,1.2fr)] lg:items-start">
        <section className="grid gap-4 lg:sticky lg:top-24" aria-labelledby="drink-name">
          <Button asChild className="w-fit" variant="ghost"><Link to={locationSlug === undefined ? "/shop" : `/shop/${locationSlug}`}>← Back to menu</Link></Button>
          <DrinkArtwork className="max-h-[28rem] w-full rounded-xl border object-cover object-[center_47%]" drink={product} priority />
          <Badge variant="secondary">{product.category}</Badge>
          <h1 className="text-3xl" id="drink-name">{product.name}</h1>
          <p className="leading-6 text-muted-foreground">{product.description}</p>
        </section>
        <Card><form onSubmit={submit}>
          <CardHeader className="flex flex-row items-end justify-between gap-4">
            <div><p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">Your drink</p><h2 className="text-2xl" id="customize-title">Customize your drink</h2></div>
            <strong aria-live="polite" className="text-xl">{formatMoney(previewTotalMinor, currency)}</strong>
          </CardHeader>
          <CardContent className="grid gap-6">
          <fieldset className="grid gap-3">
            <legend className="font-semibold">Size</legend>
            <RadioGroup className="grid grid-cols-2 gap-2 sm:grid-cols-3" onValueChange={selectVariant} value={configuration.variantId}>
              {product.variants.map((option) => {
                const defaultPrice = product.variants.find((candidate) => candidate.isDefault)?.price.amountMinor
                  ?? variant.price.amountMinor;
                const delta = option.price.amountMinor - defaultPrice;
                return (
                  <Label className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-input bg-input/30 px-3 transition-colors hover:border-primary/70 hover:bg-interactive-hover has-data-[state=checked]:border-interactive-selected-border has-data-[state=checked]:bg-interactive-selected has-data-[state=checked]:text-interactive-selected-foreground has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/60", !option.available && "cursor-not-allowed opacity-50")} htmlFor={`variant-${option.id}`} key={option.id}>
                    <RadioGroupItem
                      aria-label={`${option.name} ${priceDeltaLabel(delta, option.price.currency)}`}
                      disabled={!option.available}
                      id={`variant-${option.id}`}
                      value={option.id}
                    />
                    <span className="grid"><span>{option.name}</span><small className="text-muted-foreground">{option.available ? priceDeltaLabel(delta, option.price.currency) : "Unavailable"}</small></span>
                  </Label>
                );
              })}
            </RadioGroup>
          </fieldset>
          {variant.optionGroups.map((group) => (
            <div className="grid gap-6" key={group.id}><Separator /><OptionGroup configuration={configuration} group={group} onSelect={selectChoice} /></div>
          ))}
          <div className="sticky bottom-0 z-10 -mx-4 grid gap-3 border-t bg-card px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:p-0">
            <p className="text-sm leading-5 text-muted-foreground">Menu total. The shop confirms the final price when you place the order.</p>
            <Button className="w-full" type="submit">Add to order · {formatMoney(previewTotalMinor, currency)}</Button>
          </div>
          {addedMessage ? <Alert role="status"><AlertDescription>✓ {addedMessage} <Link to="/cart">View order</Link></AlertDescription></Alert> : null}
          </CardContent>
        </form></Card>
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
  const singleChoiceGrid = group.choices.length >= 3
    ? "sm:grid-cols-3"
    : group.choices.length === 2
      ? "sm:grid-cols-2"
      : "sm:grid-cols-1";

  return (
    <fieldset className="grid gap-3">
      <legend className="font-semibold">{group.name} {group.minimumSelections === 0 ? <small className="ml-2 text-muted-foreground">Optional</small> : null}</legend>
      {multiple ? <div className="grid gap-2">
        {group.choices.map((choice) => {
          const selected = selectedIds.includes(choice.id);
          const limitReached = multiple && !selected && selectedIds.length >= group.maximumSelections;
          return (
            <Label className={cn("grid min-h-14 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-input bg-input/30 px-3 transition-colors hover:border-primary/70 hover:bg-interactive-hover has-data-[state=checked]:border-interactive-selected-border has-data-[state=checked]:bg-interactive-selected has-data-[state=checked]:text-interactive-selected-foreground has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/60", limitReached && "cursor-not-allowed opacity-50")} htmlFor={`choice-${group.id}-${choice.id}`} key={choice.id}>
              <Checkbox
                aria-label={`${choice.name} ${priceDeltaLabel(choice.priceDelta.amountMinor, choice.priceDelta.currency)}`}
                checked={selected}
                disabled={limitReached}
                id={`choice-${group.id}-${choice.id}`}
                onCheckedChange={() => onSelect(group, choice)}
              />
              <strong>{choice.name}</strong>
              <small className="text-muted-foreground">{priceDeltaLabel(choice.priceDelta.amountMinor, choice.priceDelta.currency)}</small>
            </Label>
          );
        })}
      </div> : <RadioGroup className={cn("grid gap-2", singleChoiceGrid)} onValueChange={(choiceId) => {
        const choice = group.choices.find((candidate) => candidate.id === choiceId);
        if (choice) onSelect(group, choice);
      }} value={selectedIds[0]}>
        {group.choices.map((choice) => <Label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-input bg-input/30 px-3 transition-colors hover:border-primary/70 hover:bg-interactive-hover has-data-[state=checked]:border-interactive-selected-border has-data-[state=checked]:bg-interactive-selected has-data-[state=checked]:text-interactive-selected-foreground has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/60" htmlFor={`choice-${group.id}-${choice.id}`} key={choice.id}><RadioGroupItem aria-label={`${choice.name} ${priceDeltaLabel(choice.priceDelta.amountMinor, choice.priceDelta.currency)}`} id={`choice-${group.id}-${choice.id}`} value={choice.id} /><span className="grid"><span>{choice.name}</span><small className="text-muted-foreground">{priceDeltaLabel(choice.priceDelta.amountMinor, choice.priceDelta.currency)}</small></span></Label>)}
      </RadioGroup>}
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
      <main aria-label="Drink status" className="mx-auto grid w-full max-w-2xl gap-5 px-4 py-12">
        {retry === undefined ? (
          <>
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Menu update</p>
            <h1 className="text-3xl">{message}</h1>
          </>
        ) : (
          <ProblemState
            message="Try again or return to the menu."
            onRetry={retry}
            title={message}
          />
        )}
        <Button asChild className="w-fit" variant="outline"><Link to={locationSlug === undefined ? "/shop" : `/shop/${locationSlug}`}>Return to menu</Link></Button>
      </main>
    </div>
  );
}
