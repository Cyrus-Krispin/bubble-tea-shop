import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router";

import { Button, Dialog, Field, ProblemState } from "../../components/ui";
import type { StaffOutletContext } from "./StaffLayout";
import type { StaffLocation } from "./staffClient";
import { getIngredients, type Ingredient } from "./ingredientClient";
import { getRecipe, getRecipes, type RecipeVersion } from "./recipeClient";
import {
  archiveMenuProduct,
  archiveMenuVariant,
  configureVariantOptionChoice,
  createMenuOffering,
  createMenuVariant,
  getMenuProduct,
  getOptionGroup,
  getOptionGroups,
  MenuError,
  updateMenuOffering,
  updateMenuProduct,
  updateMenuVariant,
  type MenuOffering,
  type MenuProduct,
  type MenuVariant,
  type OptionGroup,
  type VariantOptionChoice,
} from "./menuClient";

const KEBAB_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SIGNED_QUANTITY_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;
type DetailState =
  | { status: "loading" }
  | { status: "ready"; product: MenuProduct }
  | { status: "error" };
type SupportingState =
  | { status: "loading" }
  | {
      status: "ready";
      ingredients: readonly Ingredient[];
      groups: readonly OptionGroup[];
      recipes: readonly PublishedRecipe[];
    }
  | { status: "error" };
type PublishedRecipe = { id: string; label: string; version: RecipeVersion };
type EffectRow = { key: number; ingredientId: string; quantityDelta: string };

function menuMessage(error: unknown) {
  if (error instanceof MenuError) {
    if (
      error.code === "MENU_VERSION_CONFLICT" ||
      error.code === "OPTION_VERSION_CONFLICT"
    )
      return "This catalog item changed since you opened it. The latest data has been reloaded.";
    if (error.code === "MENU_STATE_CONFLICT")
      return "That action is blocked by an available offering or an invalid recipe, ingredient, or option configuration.";
    if (error.code === "OPTION_STATE_CONFLICT")
      return "This option change would invalidate an available offering. Make it unavailable first.";
    if (error.code === "MENU_CONFLICT")
      return "That product, variant, or location offering already exists.";
    if (error.code === "OPTION_CONFLICT")
      return "That option configuration conflicts with an existing choice.";
    if (error.code === "MENU_INVALID" || error.code === "OPTION_INVALID")
      return "Check the values and try again.";
    if (error.code === "MENU_NOT_FOUND" || error.code === "OPTION_NOT_FOUND")
      return "This catalog item is no longer available.";
  }
  return "We couldn’t save this catalog change. Try again.";
}

function shouldReload(error: unknown) {
  return (
    error instanceof MenuError &&
    [
      "MENU_VERSION_CONFLICT",
      "MENU_STATE_CONFLICT",
      "OPTION_VERSION_CONFLICT",
      "OPTION_STATE_CONFLICT",
    ].includes(error.code)
  );
}

async function loadAllIngredients(
  accessToken: string,
  organizationId: string,
  signal: AbortSignal,
) {
  const first = await getIngredients(
    accessToken,
    organizationId,
    { includeArchived: false, page: 0, size: 100 },
    signal,
  );
  const result = [...first.items];
  for (let page = 1; page < first.totalPages; page += 1)
    result.push(
      ...(
        await getIngredients(
          accessToken,
          organizationId,
          { includeArchived: false, page, size: 100 },
          signal,
        )
      ).items,
    );
  return result;
}

async function loadAllGroups(
  accessToken: string,
  organizationId: string,
  signal: AbortSignal,
) {
  const first = await getOptionGroups(
    accessToken,
    organizationId,
    { includeArchived: false, page: 0, size: 100 },
    signal,
  );
  const summaries = [...first.items];
  for (let page = 1; page < first.totalPages; page += 1)
    summaries.push(
      ...(
        await getOptionGroups(
          accessToken,
          organizationId,
          { includeArchived: false, page, size: 100 },
          signal,
        )
      ).items,
    );
  return Promise.all(
    summaries.map((summary) =>
      getOptionGroup(accessToken, organizationId, summary.id, false, signal),
    ),
  );
}

async function loadPublishedRecipes(
  accessToken: string,
  organizationId: string,
  signal: AbortSignal,
) {
  const first = await getRecipes(
    accessToken,
    organizationId,
    { includeArchived: false, page: 0, size: 100 },
    signal,
  );
  const summaries = [...first.items];
  for (let page = 1; page < first.totalPages; page += 1)
    summaries.push(
      ...(
        await getRecipes(
          accessToken,
          organizationId,
          { includeArchived: false, page, size: 100 },
          signal,
        )
      ).items,
    );
  const details = await Promise.all(
    summaries.map((summary) =>
      getRecipe(accessToken, organizationId, summary.id, signal),
    ),
  );
  return details.flatMap((recipe) =>
    recipe.versions
      .filter((version) => version.status === "PUBLISHED")
      .map((version) => ({
        id: version.id,
        label: `${recipe.name} · v${version.versionNumber}`,
        version,
      })),
  );
}

function ConfirmDialog({
  children,
  description,
  onAction,
  onChanged,
  title,
}: {
  children: ReactNode;
  description: string;
  onAction: () => Promise<unknown>;
  onChanged: () => void;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  async function act() {
    setSaving(true);
    setError(undefined);
    try {
      await onAction();
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(menuMessage(caught));
      if (shouldReload(caught)) onChanged();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      description={description}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
      open={open}
      title={title}
      trigger={
        <Button size="compact" variant="danger">
          {children}
        </Button>
      }
    >
      {error === undefined ? null : (
        <p className="form-message form-message--error" role="alert">
          {error}
        </p>
      )}
      <div className="recipe-form-actions">
        <Button
          isLoading={saving}
          loadingLabel="Archiving"
          onClick={act}
          variant="danger"
        >
          Archive
        </Button>
      </div>
    </Dialog>
  );
}

function ProductDialog({
  accessToken,
  onChanged,
  organizationId,
  product,
}: {
  accessToken: string;
  onChanged: () => void;
  organizationId: string;
  product: MenuProduct;
}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.publicSlug);
  const [description, setDescription] = useState(product.description ?? "");
  const [category, setCategory] = useState(product.category ?? "");
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const [artworkKey, setArtworkKey] = useState(product.artworkKey ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    String(product.displayOrder),
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const order = Number(displayOrder);
    if (
      name.trim() === "" ||
      !KEBAB_PATTERN.test(slug.trim()) ||
      (artworkKey.trim() !== "" && !KEBAB_PATTERN.test(artworkKey.trim())) ||
      !Number.isSafeInteger(order) ||
      order < 0
    ) {
      setError(
        "Enter a name, valid kebab-case keys, and a non-negative display order.",
      );
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await updateMenuProduct(accessToken, organizationId, product.id, {
        name: name.trim(),
        publicSlug: slug.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        imageUrl: imageUrl.trim() || null,
        artworkKey: artworkKey.trim() || null,
        displayOrder: order,
        version: product.version,
      });
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(menuMessage(caught));
      if (shouldReload(caught)) onChanged();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      description="Update customer-facing metadata. Prices and recipes stay attached to variants by location."
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(product.name);
          setSlug(product.publicSlug);
          setDescription(product.description ?? "");
          setCategory(product.category ?? "");
          setImageUrl(product.imageUrl ?? "");
          setArtworkKey(product.artworkKey ?? "");
          setDisplayOrder(String(product.displayOrder));
          setError(undefined);
        }
      }}
      open={open}
      title="Edit product"
      trigger={
        <Button size="compact" variant="secondary">
          Edit product
        </Button>
      }
    >
      <form className="recipe-form" onSubmit={submit}>
        <div className="menu-field-grid menu-field-grid--two">
          <Field id={`${prefix}-name`} label="Name">
            <input
              maxLength={160}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
          <Field id={`${prefix}-slug`} label="Public slug">
            <input
              maxLength={160}
              onChange={(event) => setSlug(event.target.value)}
              value={slug}
            />
          </Field>
        </div>
        <Field id={`${prefix}-description`} label="Description">
          <textarea
            maxLength={4000}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            value={description}
          />
        </Field>
        <div className="menu-field-grid">
          <Field id={`${prefix}-category`} label="Category">
            <input
              maxLength={120}
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            />
          </Field>
          <Field id={`${prefix}-artwork`} label="Artwork key">
            <input
              maxLength={160}
              onChange={(event) => setArtworkKey(event.target.value)}
              value={artworkKey}
            />
          </Field>
          <Field id={`${prefix}-order`} label="Display order">
            <input
              min="0"
              onChange={(event) => setDisplayOrder(event.target.value)}
              type="number"
              value={displayOrder}
            />
          </Field>
        </div>
        <Field id={`${prefix}-image`} label="HTTPS image URL">
          <input
            onChange={(event) => setImageUrl(event.target.value)}
            type="url"
            value={imageUrl}
          />
        </Field>
        {error === undefined ? null : (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        <div className="recipe-form-actions">
          <Button
            isLoading={saving}
            loadingLabel="Saving product"
            type="submit"
          >
            Save product
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function VariantDialog({
  accessToken,
  onChanged,
  organizationId,
  product,
  variant,
}: {
  accessToken: string;
  onChanged: () => void;
  organizationId: string;
  product: MenuProduct;
  variant?: MenuVariant;
}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(variant?.name ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    String(variant?.displayOrder ?? 0),
  );
  const [defaultVariant, setDefaultVariant] = useState(
    variant?.defaultVariant ?? false,
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const order = Number(displayOrder);
    if (name.trim() === "" || !Number.isSafeInteger(order) || order < 0) {
      setError("Enter a name and non-negative display order.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const body = { name: name.trim(), displayOrder: order, defaultVariant };
      if (variant === undefined)
        await createMenuVariant(accessToken, organizationId, product.id, body);
      else
        await updateMenuVariant(
          accessToken,
          organizationId,
          product.id,
          variant.id,
          { ...body, version: variant.version },
        );
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(menuMessage(caught));
      if (shouldReload(caught)) onChanged();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      description="Variants are reusable sizes or forms. Changing the default is atomic."
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(variant?.name ?? "");
          setDisplayOrder(String(variant?.displayOrder ?? 0));
          setDefaultVariant(variant?.defaultVariant ?? false);
          setError(undefined);
        }
      }}
      open={open}
      title={variant === undefined ? "Add variant" : `Edit ${variant.name}`}
      trigger={
        <Button
          size="compact"
          variant={variant === undefined ? "primary" : "secondary"}
        >
          {variant === undefined ? "Add variant" : "Edit"}
        </Button>
      }
    >
      <form className="recipe-form" onSubmit={submit}>
        <Field id={`${prefix}-name`} label="Name">
          <input
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        <Field id={`${prefix}-order`} label="Display order">
          <input
            min="0"
            onChange={(event) => setDisplayOrder(event.target.value)}
            type="number"
            value={displayOrder}
          />
        </Field>
        <label className="ingredient-archive-filter">
          <input
            checked={defaultVariant}
            onChange={(event) => setDefaultVariant(event.target.checked)}
            type="checkbox"
          />
          Default variant
        </label>
        {error === undefined ? null : (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        <div className="recipe-form-actions">
          <Button
            isLoading={saving}
            loadingLabel="Saving variant"
            type="submit"
          >
            Save variant
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function OfferingDialog({
  accessToken,
  location,
  offering,
  onChanged,
  organizationId,
  recipes,
  variant,
}: {
  accessToken: string;
  location: StaffLocation;
  offering?: MenuOffering;
  onChanged: () => void;
  organizationId: string;
  recipes: readonly PublishedRecipe[];
  variant: MenuVariant;
}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [recipeVersionId, setRecipeVersionId] = useState(
    offering?.recipeVersionId ?? recipes[0]?.id ?? "",
  );
  const [priceMinor, setPriceMinor] = useState(
    String(offering?.priceMinor ?? 0),
  );
  const [available, setAvailable] = useState(offering?.available ?? false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(priceMinor);
    if (recipeVersionId === "" || !Number.isSafeInteger(price) || price < 0) {
      setError(
        "Choose a published recipe and enter a non-negative whole minor-unit price.",
      );
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      if (offering === undefined)
        await createMenuOffering(accessToken, organizationId, location.id, {
          variantId: variant.id,
          recipeVersionId,
          priceMinor: price,
          available,
        });
      else
        await updateMenuOffering(
          accessToken,
          organizationId,
          location.id,
          offering.id,
          {
            recipeVersionId,
            priceMinor: price,
            available,
            version: offering.version,
          },
        );
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(menuMessage(caught));
      if (shouldReload(caught)) onChanged();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      description={`Set the exact ${location.currencyCode} minor-unit price and published formula for ${location.name}.`}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setRecipeVersionId(offering?.recipeVersionId ?? recipes[0]?.id ?? "");
          setPriceMinor(String(offering?.priceMinor ?? 0));
          setAvailable(offering?.available ?? false);
          setError(undefined);
        }
      }}
      open={open}
      title={`${offering === undefined ? "Add" : "Edit"} ${variant.name} at ${location.name}`}
      trigger={
        <Button
          disabled={recipes.length === 0}
          size="compact"
          variant="secondary"
        >
          {offering === undefined ? "Add offering" : "Edit offering"}
        </Button>
      }
    >
      <form className="recipe-form" onSubmit={submit}>
        <Field id={`${prefix}-recipe`} label="Published recipe">
          <select
            onChange={(event) => setRecipeVersionId(event.target.value)}
            value={recipeVersionId}
          >
            <option value="">Choose recipe version</option>
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id={`${prefix}-price`}
          label={`Price (${location.currencyCode} minor units)`}
          description="For example, 650 means 6.50 for a two-decimal currency."
        >
          <input
            inputMode="numeric"
            min="0"
            onChange={(event) => setPriceMinor(event.target.value)}
            type="number"
            value={priceMinor}
          />
        </Field>
        <label className="ingredient-archive-filter">
          <input
            checked={available}
            onChange={(event) => setAvailable(event.target.checked)}
            type="checkbox"
          />
          Available to guests
        </label>
        {error === undefined ? null : (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        <div className="recipe-form-actions">
          <Button
            isLoading={saving}
            loadingLabel="Saving offering"
            type="submit"
          >
            Save offering
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ChoiceConfigurationDialog({
  accessToken,
  configured,
  groups,
  ingredients,
  onChanged,
  organizationId,
  product,
  variant,
}: {
  accessToken: string;
  configured?: VariantOptionChoice;
  groups: readonly OptionGroup[];
  ingredients: readonly Ingredient[];
  onChanged: () => void;
  organizationId: string;
  product: MenuProduct;
  variant: MenuVariant;
}) {
  const choices = useMemo(
    () =>
      groups
        .flatMap((group) =>
          group.choices
            .filter((choice) => !choice.archived)
            .map((choice) => ({ choice, group })),
        )
        .filter(
          ({ choice }) =>
            configured !== undefined ||
            !variant.choices.some((item) => item.choiceId === choice.id),
        ),
    [configured, groups, variant.choices],
  );
  const [open, setOpen] = useState(false);
  const [choiceId, setChoiceId] = useState(
    configured?.choiceId ?? choices[0]?.choice.id ?? "",
  );
  const [enabled, setEnabled] = useState(configured?.enabled ?? true);
  const [priceDelta, setPriceDelta] = useState(
    String(configured?.priceDeltaMinor ?? 0),
  );
  const [rows, setRows] = useState<EffectRow[]>([]);
  const [nextKey, setNextKey] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  function reset() {
    setChoiceId(configured?.choiceId ?? choices[0]?.choice.id ?? "");
    setEnabled(configured?.enabled ?? true);
    setPriceDelta(String(configured?.priceDeltaMinor ?? 0));
    setRows(
      configured?.ingredientEffects.map((effect, index) => ({
        key: index,
        ingredientId: effect.ingredientId,
        quantityDelta: effect.quantityDelta,
      })) ?? [],
    );
    setNextKey(configured?.ingredientEffects.length ?? 0);
    setError(undefined);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const delta = Number(priceDelta);
    const ids = rows.map((row) => row.ingredientId);
    const effectsValid =
      rows.every(
        (row) =>
          row.ingredientId !== "" &&
          ingredients.some(
            (ingredient) => ingredient.id === row.ingredientId,
          ) &&
          SIGNED_QUANTITY_PATTERN.test(row.quantityDelta.trim()) &&
          Number(row.quantityDelta) !== 0,
      ) && new Set(ids).size === ids.length;
    if (choiceId === "" || !Number.isSafeInteger(delta) || !effectsValid) {
      setError(
        "Choose a choice, enter a whole minor-unit delta, and use each ingredient once with a non-zero signed quantity.",
      );
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await configureVariantOptionChoice(
        accessToken,
        organizationId,
        product.id,
        variant.id,
        choiceId,
        {
          enabled,
          priceDeltaMinor: delta,
          version: configured?.version ?? null,
          ingredientEffects: rows.map((row) => ({
            ingredientId: row.ingredientId,
            quantityDelta: row.quantityDelta.trim(),
          })),
        },
      );
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(menuMessage(caught));
      if (shouldReload(caught)) onChanged();
    } finally {
      setSaving(false);
    }
  }
  const selected = choices.find((item) => item.choice.id === choiceId);
  return (
    <Dialog
      description="Set enablement, exact price delta, and the complete signed inventory effect for one choice."
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
      open={open}
      title={
        configured === undefined
          ? "Configure option choice"
          : `Configure ${configured.choiceName}`
      }
      trigger={
        <Button
          disabled={configured === undefined && choices.length === 0}
          size="compact"
          variant="secondary"
        >
          {configured === undefined ? "Add option choice" : "Configure"}
        </Button>
      }
    >
      <form className="recipe-form" onSubmit={submit}>
        {configured === undefined ? (
          <Field id={`configuration-choice-${variant.id}`} label="Choice">
            <select
              onChange={(event) => setChoiceId(event.target.value)}
              value={choiceId}
            >
              <option value="">Choose option</option>
              {choices.map(({ choice, group }) => (
                <option key={choice.id} value={choice.id}>
                  {group.name} · {choice.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p>
            <strong>{configured.groupName}</strong> · {configured.choiceName}
          </p>
        )}
        <div className="menu-field-grid menu-field-grid--two">
          <Field
            id={`configuration-price-${variant.id}-${configured?.choiceId ?? "new"}`}
            label="Price delta (minor units)"
          >
            <input
              inputMode="numeric"
              onChange={(event) => setPriceDelta(event.target.value)}
              type="number"
              value={priceDelta}
            />
          </Field>
          <label className="ingredient-archive-filter">
            <input
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              type="checkbox"
            />
            Enabled for this variant
          </label>
        </div>
        <div className="formula-rows">
          {rows.map((row, index) => (
            <div className="formula-row" key={row.key}>
              <Field
                id={`effect-ingredient-${variant.id}-${row.key}`}
                label={`Effect ingredient ${index + 1}`}
              >
                <select
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key
                          ? { ...item, ingredientId: event.target.value }
                          : item,
                      ),
                    )
                  }
                  value={row.ingredientId}
                >
                  <option value="">Choose ingredient</option>
                  {ingredients.map((ingredient) => (
                    <option
                      disabled={rows.some(
                        (item) =>
                          item.key !== row.key &&
                          item.ingredientId === ingredient.id,
                      )}
                      key={ingredient.id}
                      value={ingredient.id}
                    >
                      {ingredient.name} · {ingredient.baseUnit.toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id={`effect-quantity-${variant.id}-${row.key}`}
                label={`Signed quantity ${index + 1}`}
              >
                <input
                  inputMode="decimal"
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key
                          ? { ...item, quantityDelta: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="-10.000000"
                  value={row.quantityDelta}
                />
              </Field>
              <Button
                aria-label={`Remove ingredient effect ${index + 1}`}
                onClick={() =>
                  setRows((current) =>
                    current.filter((item) => item.key !== row.key),
                  )
                }
                size="compact"
                variant="danger"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button
          disabled={rows.length >= Math.min(100, ingredients.length)}
          onClick={() => {
            setRows((current) => [
              ...current,
              { key: nextKey, ingredientId: "", quantityDelta: "" },
            ]);
            setNextKey((value) => value + 1);
          }}
          size="compact"
          variant="secondary"
        >
          Add ingredient effect
        </Button>
        {selected === undefined && configured === undefined ? (
          <p className="staff-muted">
            Create option groups and choices before configuring variants.
          </p>
        ) : null}
        {error === undefined ? null : (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        <div className="recipe-form-actions">
          <Button
            isLoading={saving}
            loadingLabel="Saving configuration"
            type="submit"
          >
            Save configuration
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function VariantCard({
  accessToken,
  groups,
  ingredients,
  locations,
  onChanged,
  organizationId,
  product,
  recipes,
  variant,
}: {
  accessToken: string;
  groups: readonly OptionGroup[];
  ingredients: readonly Ingredient[];
  locations: readonly StaffLocation[];
  onChanged: () => void;
  organizationId: string;
  product: MenuProduct;
  recipes: readonly PublishedRecipe[];
  variant: MenuVariant;
}) {
  return (
    <article className="menu-variant-card">
      <div className="recipe-version-heading">
        <div>
          <h2>{variant.name}</h2>
          <p className="staff-muted">
            Order {variant.displayOrder}
            {variant.defaultVariant ? " · default" : ""}
            {variant.archived ? " · archived" : ""}
          </p>
        </div>
        {product.archived || variant.archived ? null : (
          <div className="recipe-row-actions">
            <VariantDialog
              accessToken={accessToken}
              onChanged={onChanged}
              organizationId={organizationId}
              product={product}
              variant={variant}
            />
            <ConfirmDialog
              description="Archival is blocked while an available offering uses this variant."
              onAction={() =>
                archiveMenuVariant(
                  accessToken,
                  organizationId,
                  product.id,
                  variant.id,
                  variant.version,
                )
              }
              onChanged={onChanged}
              title={`Archive ${variant.name}?`}
            >
              Archive
            </ConfirmDialog>
          </div>
        )}
      </div>
      <section
        className="menu-subsection"
        aria-label={`${variant.name} offerings`}
      >
        <h3>Location offerings</h3>
        {locations.length === 0 ? (
          <p className="staff-muted">No assigned active locations.</p>
        ) : (
          <div className="menu-location-grid">
            {locations.map((location) => {
              const offering = product.offerings.find(
                (item) =>
                  item.variantId === variant.id &&
                  item.locationId === location.id,
              );
              return (
                <div className="menu-location-card" key={location.id}>
                  <div>
                    <strong>{location.name}</strong>
                    <p className="staff-muted">
                      {offering === undefined
                        ? "Not offered"
                        : `${offering.priceMinor} ${offering.currencyCode} minor units · ${offering.recipeName} v${offering.recipeVersionNumber} · ${offering.available ? "available" : "unavailable"}`}
                    </p>
                  </div>
                  {product.archived || variant.archived ? null : (
                    <OfferingDialog
                      accessToken={accessToken}
                      location={location}
                      offering={offering}
                      onChanged={onChanged}
                      organizationId={organizationId}
                      recipes={recipes}
                      variant={variant}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section
        className="menu-subsection"
        aria-label={`${variant.name} option configuration`}
      >
        <div className="menu-subsection-heading">
          <h3>Option configuration</h3>
          {product.archived || variant.archived ? null : (
            <ChoiceConfigurationDialog
              accessToken={accessToken}
              groups={groups}
              ingredients={ingredients}
              onChanged={onChanged}
              organizationId={organizationId}
              product={product}
              variant={variant}
            />
          )}
        </div>
        {variant.choices.length === 0 ? (
          <p className="staff-muted">No option choices configured.</p>
        ) : (
          <div className="option-choice-list">
            {variant.choices.map((choice) => (
              <div className="option-choice-card" key={choice.id}>
                <div>
                  <strong>
                    {choice.groupName} · {choice.choiceName}
                  </strong>
                  <p className="staff-muted">
                    {choice.enabled ? "Enabled" : "Disabled"} · price delta{" "}
                    {choice.priceDeltaMinor} minor units ·{" "}
                    {choice.ingredientEffects.length} ingredient effect
                    {choice.ingredientEffects.length === 1 ? "" : "s"}
                  </p>
                </div>
                {product.archived || variant.archived ? null : (
                  <ChoiceConfigurationDialog
                    accessToken={accessToken}
                    configured={choice}
                    groups={groups}
                    ingredients={ingredients}
                    onChanged={onChanged}
                    organizationId={organizationId}
                    product={product}
                    variant={variant}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

export default function MenuProductDetailPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const requestedOrganization = searchParams.get("organizationId");
  const membership =
    staffContext.memberships.find(
      (item) => item.organizationId === requestedOrganization,
    ) ?? staffContext.memberships[0];
  const organizationId = membership?.organizationId ?? "";
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [supporting, setSupporting] = useState<SupportingState>({
    status: "loading",
  });
  useEffect(() => {
    if (!productId || organizationId === "") return;
    const controller = new AbortController();
    getMenuProduct(accessToken, organizationId, productId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setState({ status: "ready", product: result });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [accessToken, organizationId, productId, reloadVersion]);
  useEffect(() => {
    if (organizationId === "") return;
    const controller = new AbortController();
    Promise.all([
      loadAllIngredients(accessToken, organizationId, controller.signal),
      loadAllGroups(accessToken, organizationId, controller.signal),
      loadPublishedRecipes(accessToken, organizationId, controller.signal),
    ])
      .then(([ingredients, groups, recipes]) => {
        if (!controller.signal.aborted)
          setSupporting({ status: "ready", ingredients, groups, recipes });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSupporting({ status: "error" });
      });
    return () => controller.abort();
  }, [accessToken, organizationId, reloadVersion]);
  const reload = () => setReloadVersion((value) => value + 1);
  if (!productId || organizationId === "")
    return (
      <main
        aria-label="Menu product detail"
        className="staff-main"
        id="staff-workspace"
      >
        <ProblemState
          title="Product unavailable"
          message="A valid catalog scope is required."
        />
      </main>
    );
  if (state.status === "loading")
    return (
      <main
        aria-label="Menu product detail"
        className="staff-main"
        id="staff-workspace"
      >
        <p role="status">Loading menu product…</p>
      </main>
    );
  if (state.status === "error")
    return (
      <main
        aria-label="Menu product detail"
        className="staff-main"
        id="staff-workspace"
      >
        <ProblemState
          title="Product unavailable"
          message="We couldn’t load this menu product."
          onRetry={reload}
        />
      </main>
    );
  const { product } = state;
  return (
    <main
      aria-label="Menu product detail"
      className="staff-main"
      id="staff-workspace"
    >
      <Link className="staff-back-link" to={`/staff/catalog/menu?organizationId=${encodeURIComponent(organizationId)}`}>
        ← Back to menu
      </Link>
      <div className="recipe-detail-heading">
        <div>
          <p className="eyebrow">{product.category ?? "Menu product"}</p>
          <h1>{product.name}</h1>
          <p className="staff-muted">
            /{product.publicSlug} · order {product.displayOrder} ·{" "}
            {product.archived ? "archived" : "active"}
          </p>
          {product.description === null ? null : <p>{product.description}</p>}
        </div>
        {product.archived ? null : (
          <div className="recipe-row-actions">
            <ProductDialog
              accessToken={accessToken}
              onChanged={reload}
              organizationId={organizationId}
              product={product}
            />
            <ConfirmDialog
              description="Archival is blocked while any available location offering uses this product."
              onAction={() =>
                archiveMenuProduct(
                  accessToken,
                  organizationId,
                  product.id,
                  product.version,
                )
              }
              onChanged={reload}
              title={`Archive ${product.name}?`}
            >
              Archive product
            </ConfirmDialog>
          </div>
        )}
      </div>
      <section aria-labelledby="variants-title">
        <div className="recipe-history-heading">
          <div>
            <h2 id="variants-title">Variants</h2>
            <p className="staff-muted">
              Each variant owns its location offerings and option configuration.
            </p>
          </div>
          {product.archived ? null : (
            <VariantDialog
              accessToken={accessToken}
              onChanged={reload}
              organizationId={organizationId}
              product={product}
            />
          )}
        </div>
        {supporting.status === "loading" ? (
          <p role="status">Loading recipes, options, and ingredients…</p>
        ) : null}
        {supporting.status === "error" ? (
          <ProblemState
            title="Configuration data unavailable"
            message="We couldn’t load recipes, options, and ingredients needed to edit this product."
            onRetry={reload}
          />
        ) : null}
        {supporting.status === "ready" && supporting.recipes.length === 0 ? (
          <p className="form-message">
            Publish a recipe before creating a location offering.
          </p>
        ) : null}
        <div className="recipe-version-list">
          {product.variants.length === 0 ? (
            <p className="staff-muted">No variants yet.</p>
          ) : (
            product.variants.map((variant) =>
              supporting.status === "ready" ? (
                <VariantCard
                  accessToken={accessToken}
                  groups={supporting.groups}
                  ingredients={supporting.ingredients}
                  key={variant.id}
                  locations={membership?.locations ?? []}
                  onChanged={reload}
                  organizationId={organizationId}
                  product={product}
                  recipes={supporting.recipes}
                  variant={variant}
                />
              ) : (
                <article className="menu-variant-card" key={variant.id}>
                  <h2>{variant.name}</h2>
                  <p className="staff-muted">
                    Configuration tools are loading.
                  </p>
                </article>
              ),
            )
          )}
        </div>
      </section>
    </main>
  );
}
