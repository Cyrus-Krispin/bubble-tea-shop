import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { cn } from "../../lib/utils";
import { formatMoney } from "./formatMoney";
import type { DrinkConfiguration } from "./pricing";
import type { CatalogOptionChoice, CatalogOptionGroup } from "./types";

function priceDeltaLabel(amount: number, currency: string) {
  return amount === 0 ? "Included" : `${amount > 0 ? "+" : "−"}${formatMoney(Math.abs(amount), currency)}`;
}

export function DrinkOptionGroup({
  configuration,
  group,
  onSelect,
}: {
  configuration: DrinkConfiguration;
  group: CatalogOptionGroup;
  onSelect: (group: CatalogOptionGroup, choice: CatalogOptionChoice | null) => void;
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
            <Label className={cn("grid min-h-14 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-input bg-input/30 px-3 transition-colors has-data-[state=checked]:border-interactive-selected-border has-data-[state=checked]:bg-interactive-selected has-data-[state=checked]:text-interactive-selected-foreground has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/60", limitReached ? "cursor-not-allowed opacity-50" : "hover:border-primary/70 hover:bg-interactive-hover")} htmlFor={`choice-${group.id}-${choice.id}`} key={choice.id}>
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
        if (choiceId === "__none__" && group.minimumSelections === 0) {
          onSelect(group, null); return;
        }
        const choice = group.choices.find((candidate) => candidate.id === choiceId);
        if (choice) onSelect(group, choice);
      }} value={selectedIds[0] ?? (group.minimumSelections === 0 ? "__none__" : "")}>
        {group.minimumSelections === 0 ? <Label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-input bg-input/30 px-3 has-data-[state=checked]:border-interactive-selected-border has-data-[state=checked]:bg-interactive-selected has-data-[state=checked]:text-interactive-selected-foreground" htmlFor={`choice-${group.id}-none`}>
          <RadioGroupItem aria-label={`None for ${group.name}`} id={`choice-${group.id}-none`} value="__none__" /><span>None</span>
        </Label> : null}
        {group.choices.map((choice) => <Label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-input bg-input/30 px-3 transition-colors hover:border-primary/70 hover:bg-interactive-hover has-data-[state=checked]:border-interactive-selected-border has-data-[state=checked]:bg-interactive-selected has-data-[state=checked]:text-interactive-selected-foreground has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/60" htmlFor={`choice-${group.id}-${choice.id}`} key={choice.id}><RadioGroupItem aria-label={`${choice.name} ${priceDeltaLabel(choice.priceDelta.amountMinor, choice.priceDelta.currency)}`} id={`choice-${group.id}-${choice.id}`} value={choice.id} /><span className="grid"><span>{choice.name}</span><small className="text-muted-foreground">{priceDeltaLabel(choice.priceDelta.amountMinor, choice.priceDelta.currency)}</small></span></Label>)}
      </RadioGroup>}
    </fieldset>
  );
}

