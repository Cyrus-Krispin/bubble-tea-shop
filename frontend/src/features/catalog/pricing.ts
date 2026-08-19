import type { CatalogOptionGroup, CatalogProduct, CatalogVariant } from "./types";

export type OptionSelection = {
  groupId: string;
  groupName: string;
  choiceIds: string[];
  choiceNames: string[];
};

export type DrinkConfiguration = {
  variantId: string;
  variantName: string;
  selections: OptionSelection[];
};

function defaultChoices(group: CatalogOptionGroup) {
  const selected = group.choices.filter((choice) => choice.isDefault);
  for (const choice of group.choices) {
    if (selected.length >= group.minimumSelections) break;
    if (!selected.some((current) => current.id === choice.id)) selected.push(choice);
  }
  return selected.slice(0, group.maximumSelections);
}

export function configurationForVariant(variant: CatalogVariant): DrinkConfiguration {
  return {
    variantId: variant.id,
    variantName: variant.name,
    selections: variant.optionGroups.map((group) => {
      const choices = defaultChoices(group);
      return {
        groupId: group.id,
        groupName: group.name,
        choiceIds: choices.map((choice) => choice.id),
        choiceNames: choices.map((choice) => choice.name),
      };
    }),
  };
}

export function createDefaultConfiguration(product: CatalogProduct): DrinkConfiguration {
  const variant = product.variants.find((candidate) => candidate.isDefault && candidate.available)
    ?? product.variants.find((candidate) => candidate.available);
  if (!variant) throw new Error("catalog product has no available variant");
  return configurationForVariant(variant);
}

export function calculatePreviewTotal(product: CatalogProduct, configuration: DrinkConfiguration) {
  const variant = product.variants.find((candidate) => (
    candidate.id === configuration.variantId && candidate.available
  ));
  if (!variant) throw new Error("catalog selection is invalid");

  let total = variant.price.amountMinor;
  for (const group of variant.optionGroups) {
    const selection = configuration.selections.find((candidate) => candidate.groupId === group.id);
    const choiceIds = selection?.choiceIds ?? [];
    if (choiceIds.length < group.minimumSelections || choiceIds.length > group.maximumSelections) {
      throw new Error("catalog selection is invalid");
    }
    for (const choiceId of choiceIds) {
      const choice = group.choices.find((candidate) => candidate.id === choiceId);
      if (!choice) throw new Error("catalog selection is invalid");
      total += choice.priceDelta.amountMinor;
    }
  }
  return total;
}
