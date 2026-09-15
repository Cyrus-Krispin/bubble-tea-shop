import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/shared/Field";
import { SelectField } from "../../components/shared/SelectField";
import { DrinkOptionGroup } from "../catalog/DrinkOptionGroup";
import { formatMoney } from "../catalog/formatMoney";
import { calculatePreviewTotal, configurationForVariant, createDefaultConfiguration } from "../catalog/pricing";
import type { CatalogOptionChoice, CatalogOptionGroup, CatalogProduct } from "../catalog/types";

export type CounterLine = { variantId: string; quantity: number; optionChoiceIds: string[]; name: string; unitPrice: number };

export function CounterDrink({ product, onAdd, disabled }: { product: CatalogProduct; onAdd: (line: CounterLine) => void; disabled: boolean }) {
  const [configuration, setConfiguration] = useState(() => createDefaultConfiguration(product));
  const [quantity, setQuantity] = useState(1);
  const variant = product.variants.find((item) => item.id === configuration.variantId)!;
  function select(group: CatalogOptionGroup, choice: CatalogOptionChoice) {
    setConfiguration((current) => ({ ...current, selections: current.selections.map((selection) => {
      if (selection.groupId !== group.id) return selection;
      const ids = group.maximumSelections === 1 ? [choice.id] : selection.choiceIds.includes(choice.id)
        ? selection.choiceIds.filter((id) => id !== choice.id) : [...selection.choiceIds, choice.id].slice(0, group.maximumSelections);
      return { ...selection, choiceIds: ids, choiceNames: group.choices.filter((item) => ids.includes(item.id)).map((item) => item.name) };
    }) }));
  }
  let preview: number | null = null;
  try { preview = calculatePreviewTotal(product, configuration); } catch { /* Incomplete required selections disable submission. */ }
  return <fieldset className="grid gap-4" disabled={disabled}>
    <legend className="mb-3 text-lg font-semibold">{product.name}</legend>
    <SelectField id="counter-size" label="Size" value={configuration.variantId}
      options={product.variants.filter((item) => item.available).map((item) => ({ label: item.name, value: item.id }))}
      onValueChange={(id) => { const next = product.variants.find((item) => item.id === id); if (next) setConfiguration(configurationForVariant(next)); }} />
    {variant.optionGroups.map((group) => <DrinkOptionGroup key={group.id} configuration={configuration} group={group} onSelect={select} />)}
    <Field id="counter-quantity" label="Quantity"><Input id="counter-quantity" type="number" min={1} max={20} value={quantity}
      onChange={(event) => setQuantity(Number(event.target.value))} /></Field>
    <Button disabled={disabled || preview === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 20}
      onClick={() => { if (preview !== null) onAdd({ variantId: variant.id, quantity,
        optionChoiceIds: configuration.selections.flatMap((item) => item.choiceIds),
        name: `${product.name} · ${variant.name}`, unitPrice: preview }); }}>
      Add drink{preview === null ? "" : ` · ${formatMoney(preview * quantity, variant.price.currency)}`}
    </Button>
  </fieldset>;
}
