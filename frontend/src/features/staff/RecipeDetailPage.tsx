import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router";

import { Button, Dialog, Field, ProblemState } from "../../components/ui";
import type { StaffOutletContext } from "./StaffLayout";
import { getIngredients, type Ingredient } from "./ingredientClient";
import {
  archiveRecipe,
  createRecipeVersion,
  getRecipe,
  publishRecipeVersion,
  RecipeError,
  replaceRecipeDraft,
  retireRecipeVersion,
  updateRecipe,
  type Recipe,
  type RecipeComponent,
  type RecipeVersion,
} from "./recipeClient";

const QUANTITY_PATTERN = /^[0-9]+(\.[0-9]{1,6})?$/;

type DetailState =
  | { status: "loading" }
  | { status: "ready"; recipe: Recipe }
  | { status: "error"; error: unknown };

type IngredientState =
  | { status: "loading" }
  | { status: "ready"; ingredients: readonly Ingredient[] }
  | { status: "error" };

type FormulaRow = { key: number; ingredientId: string; quantity: string };

function unitLabel(component: RecipeComponent) {
  if (component.baseUnit === "GRAM") return "g";
  if (component.baseUnit === "MILLILITER") return "ml";
  return "each";
}

function mutationMessage(error: unknown) {
  if (error instanceof RecipeError) {
    if (error.code === "RECIPE_VERSION_CONFLICT") {
      return "This recipe changed since you opened it. The latest version has been reloaded.";
    }
    if (error.code === "RECIPE_STATE_CONFLICT") {
      return "That action is no longer allowed. The recipe may be published, archived, or in use by an available menu item.";
    }
    if (error.code === "RECIPE_CONFLICT") return "That recipe name is already in use.";
    if (error.code === "RECIPE_INVALID") return "Check the recipe details and try again.";
    if (error.code === "RECIPE_NOT_FOUND") return "This recipe is no longer available in this organization.";
  }
  return "We couldn’t save this recipe. Try again.";
}

function shouldReload(error: unknown) {
  return error instanceof RecipeError
    && (error.code === "RECIPE_VERSION_CONFLICT" || error.code === "RECIPE_STATE_CONFLICT");
}

async function loadAllIngredients(
  accessToken: string,
  organizationId: string,
  signal: AbortSignal,
) {
  const first = await getIngredients(accessToken, organizationId, {
    includeArchived: false, page: 0, size: 100,
  }, signal);
  const ingredients = [...first.items];
  for (let page = 1; page < first.totalPages; page += 1) {
    const next = await getIngredients(accessToken, organizationId, {
      includeArchived: false, page, size: 100,
    }, signal);
    ingredients.push(...next.items);
  }
  return ingredients;
}

function MetadataDialog({
  accessToken,
  onChanged,
  organizationId,
  recipe,
}: {
  accessToken: string;
  onChanged: () => void;
  organizationId: string;
  recipe: Recipe;
}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(recipe.name);
  const [description, setDescription] = useState(recipe.description ?? "");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() === "") {
      setError("Enter a recipe name.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await updateRecipe(accessToken, organizationId, recipe.id, {
        name: name.trim(),
        description: description.trim() || null,
        version: recipe.version,
      });
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(mutationMessage(caught));
      if (shouldReload(caught)) onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description="Change the stable recipe name and staff-facing notes. Formula versions are unaffected."
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setName(recipe.name);
          setDescription(recipe.description ?? "");
          setError(undefined);
        }
      }}
      open={open}
      title="Edit recipe details"
      trigger={<Button size="compact" variant="secondary">Edit details</Button>}
    >
      <form className="recipe-form" onSubmit={submit}>
        <Field id={`${prefix}-name`} label="Name">
          <input maxLength={160} onChange={(event) => setName(event.target.value)} required value={name} />
        </Field>
        <Field id={`${prefix}-description`} label="Description">
          <textarea maxLength={4000} onChange={(event) => setDescription(event.target.value)} rows={4} value={description} />
        </Field>
        {error === undefined ? null : <p className="form-message form-message--error" role="alert">{error}</p>}
        <div className="recipe-form-actions">
          <Button isLoading={saving} loadingLabel="Saving recipe" type="submit">Save details</Button>
        </div>
      </form>
    </Dialog>
  );
}

function FormulaDialog({
  accessToken,
  draft,
  ingredients,
  onChanged,
  organizationId,
  recipeId,
}: {
  accessToken: string;
  draft: RecipeVersion;
  ingredients: readonly Ingredient[];
  onChanged: () => void;
  organizationId: string;
  recipeId: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<FormulaRow[]>([]);
  const [nextKey, setNextKey] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  function reset() {
    setRows(draft.components.map((component, index) => ({
      key: index,
      ingredientId: component.ingredientId,
      quantity: component.quantity,
    })));
    setNextKey(draft.components.length);
    setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ids = rows.map((row) => row.ingredientId);
    const valid = rows.every((row) => row.ingredientId !== ""
      && ingredients.some((ingredient) => ingredient.id === row.ingredientId)
      && QUANTITY_PATTERN.test(row.quantity.trim())
      && Number(row.quantity) > 0)
      && new Set(ids).size === ids.length;
    if (!valid) {
      setError("Choose each ingredient once and enter a positive quantity with up to 6 decimal places.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await replaceRecipeDraft(accessToken, organizationId, recipeId, draft.id, {
        version: draft.version,
        components: rows.map((row) => ({
          ingredientId: row.ingredientId,
          quantity: row.quantity.trim(),
        })),
      });
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(mutationMessage(caught));
      if (shouldReload(caught)) onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description="Replace the complete draft formula. Quantities use each ingredient’s fixed base unit."
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
      open={open}
      title={`Edit formula · version ${draft.versionNumber}`}
      trigger={<Button size="compact">Edit formula</Button>}
    >
      <form className="recipe-form" onSubmit={submit}>
        <div className="formula-rows">
          {rows.length === 0 ? (
            <p className="staff-muted">This draft is empty. Add an ingredient to begin.</p>
          ) : rows.map((row, index) => (
            <div className="formula-row" key={row.key}>
              <Field id={`formula-ingredient-${row.key}`} label={`Ingredient ${index + 1}`}>
                <select onChange={(event) => setRows((current) => current.map((item) => (
                  item.key === row.key ? { ...item, ingredientId: event.target.value } : item
                )))} required value={row.ingredientId}>
                  <option value="">Choose ingredient</option>
                  {ingredients.map((ingredient) => (
                    <option
                      disabled={rows.some((item) => item.key !== row.key
                        && item.ingredientId === ingredient.id)}
                      key={ingredient.id}
                      value={ingredient.id}
                    >
                      {ingredient.name} · {ingredient.baseUnit.toLowerCase()}
                    </option>
                  ))}
                  {row.ingredientId === "" || ingredients.some((ingredient) => (
                    ingredient.id === row.ingredientId
                  )) ? null : (
                    <option disabled value={row.ingredientId}>
                      {draft.components.find((component) => (
                        component.ingredientId === row.ingredientId
                      ))?.ingredientName ?? "Unavailable ingredient"} · unavailable
                    </option>
                  )}
                </select>
              </Field>
              <Field id={`formula-quantity-${row.key}`} label={`Quantity ${index + 1}`}>
                <input inputMode="decimal" onChange={(event) => setRows((current) => current.map((item) => (
                  item.key === row.key ? { ...item, quantity: event.target.value } : item
                )))} required value={row.quantity} />
              </Field>
              <Button
                aria-label={`Remove ingredient ${index + 1}`}
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
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
            setRows((current) => [...current, { key: nextKey, ingredientId: "", quantity: "" }]);
            setNextKey((value) => value + 1);
          }}
          size="compact"
          variant="secondary"
        >
          Add ingredient
        </Button>
        {error === undefined ? null : <p className="form-message form-message--error" role="alert">{error}</p>}
        <div className="recipe-form-actions">
          <Button isLoading={saving} loadingLabel="Saving formula" type="submit">Save formula</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ActionDialog({
  actionLabel,
  children,
  description,
  disabled = false,
  onAction,
  onChanged,
  title,
  variant = "primary",
}: {
  actionLabel: string;
  children: ReactNode;
  description: string;
  disabled?: boolean;
  onAction: () => Promise<unknown>;
  onChanged: () => void;
  title: string;
  variant?: "primary" | "danger" | "secondary";
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
      setError(mutationMessage(caught));
      if (shouldReload(caught)) onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description={description}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(undefined);
      }}
      open={open}
      title={title}
      trigger={<Button disabled={disabled} size="compact" variant={variant}>{children}</Button>}
    >
      {error === undefined ? null : <p className="form-message form-message--error" role="alert">{error}</p>}
      <div className="recipe-form-actions">
        <Button isLoading={saving} loadingLabel={actionLabel} onClick={act} variant={variant}>
          {actionLabel}
        </Button>
      </div>
    </Dialog>
  );
}

function VersionCard({
  accessToken,
  canEditFormula,
  ingredients,
  onChanged,
  organizationId,
  recipe,
  version,
}: {
  accessToken: string;
  canEditFormula: boolean;
  ingredients: readonly Ingredient[];
  onChanged: () => void;
  organizationId: string;
  recipe: Recipe;
  version: RecipeVersion;
}) {
  return (
    <article className="recipe-version-card">
      <div className="recipe-version-heading">
        <div>
          <h2>Version {version.versionNumber}</h2>
          <span className={`recipe-status recipe-status--${version.status.toLowerCase()}`}>
            {version.status}
          </span>
        </div>
        {!recipe.archived && version.status === "DRAFT" ? (
          <div className="recipe-row-actions">
            {canEditFormula ? (
              <FormulaDialog
                accessToken={accessToken}
                draft={version}
                ingredients={ingredients}
                onChanged={onChanged}
                organizationId={organizationId}
                recipeId={recipe.id}
              />
            ) : <Button disabled size="compact">Edit formula</Button>}
            <ActionDialog
              actionLabel="Publish version"
              description="Publishing permanently freezes this formula. Existing published versions remain unchanged."
              disabled={version.components.length === 0}
              onAction={() => publishRecipeVersion(
                accessToken, organizationId, recipe.id, version.id, version.version,
              )}
              onChanged={onChanged}
              title={`Publish version ${version.versionNumber}?`}
            >
              Publish
            </ActionDialog>
          </div>
        ) : null}
        {!recipe.archived && version.status === "PUBLISHED" ? (
          <ActionDialog
            actionLabel="Retire version"
            description="Retirement is blocked while an available menu item uses this exact formula."
            onAction={() => retireRecipeVersion(
              accessToken, organizationId, recipe.id, version.id, version.version,
            )}
            onChanged={onChanged}
            title={`Retire version ${version.versionNumber}?`}
            variant="secondary"
          >
            Retire
          </ActionDialog>
        ) : null}
      </div>
      {version.components.length === 0 ? (
        <p className="staff-muted">No ingredients in this draft yet.</p>
      ) : (
        <ul className="recipe-components">
          {version.components.map((component) => (
            <li key={component.ingredientId}>
              <span>{component.ingredientName}</span>
              <strong>{component.quantity} {unitLabel(component)}</strong>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function RecipeDetailPage() {
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const { recipeId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const requestedOrganizationId = searchParams.get("organizationId");
  const organizationId = requestedOrganizationId === null
    ? staffContext.memberships[0]?.organizationId ?? ""
    : staffContext.memberships.some((membership) => (
      membership.organizationId === requestedOrganizationId
    )) ? requestedOrganizationId : "";
  const [detailState, setDetailState] = useState<DetailState>({ status: "loading" });
  const [ingredientState, setIngredientState] = useState<IngredientState>({ status: "loading" });
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    if (organizationId === "" || recipeId === "") return;
    const controller = new AbortController();
    getRecipe(accessToken, organizationId, recipeId, controller.signal)
      .then((recipe) => {
        if (!controller.signal.aborted) setDetailState({ status: "ready", recipe });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setDetailState({ status: "error", error });
      });
    return () => controller.abort();
  }, [accessToken, organizationId, recipeId, reloadVersion]);

  useEffect(() => {
    if (organizationId === "") return;
    const controller = new AbortController();
    loadAllIngredients(accessToken, organizationId, controller.signal)
      .then((ingredients) => {
        if (!controller.signal.aborted) setIngredientState({ status: "ready", ingredients });
      })
      .catch(() => {
        if (!controller.signal.aborted) setIngredientState({ status: "error" });
      });
    return () => controller.abort();
  }, [accessToken, organizationId, reloadVersion]);

  function reload() {
    setReloadVersion((value) => value + 1);
  }

  const ingredients = ingredientState.status === "ready" ? ingredientState.ingredients : [];
  const recipe = detailState.status === "ready" ? detailState.recipe : undefined;
  const hasDraft = recipe?.versions.some((version) => version.status === "DRAFT") ?? false;

  if (organizationId === "" || recipeId === "") {
    return (
      <main aria-label="Recipe detail" className="staff-main" id="staff-workspace">
        <ProblemState title="No recipe scope" message="Choose a recipe from an organization you can manage." />
      </main>
    );
  }

  return (
    <main aria-label="Recipe detail" className="staff-main" id="staff-workspace">
      <Link className="staff-back-link" to={`/staff/catalog/recipes?organizationId=${encodeURIComponent(organizationId)}`}>← Back to recipes</Link>
      {detailState.status === "loading" ? <p role="status">Loading recipe…</p> : null}
      {detailState.status === "error" ? (
        <ProblemState
          title="Recipe unavailable"
          message="We couldn’t load this recipe in the selected organization."
          onRetry={() => reload()}
        />
      ) : null}
      {recipe === undefined ? null : (
        <>
          <div className="recipe-detail-heading">
            <div>
              <p className="eyebrow">Recipe management</p>
              <h1>{recipe.name}</h1>
              <p className="staff-muted">{recipe.description ?? "No description"}</p>
            </div>
            {!recipe.archived ? (
              <div className="recipe-row-actions">
                <MetadataDialog
                  accessToken={accessToken}
                  onChanged={reload}
                  organizationId={organizationId}
                  recipe={recipe}
                />
                <ActionDialog
                  actionLabel="Archive recipe"
                  description="Archival is blocked while an available menu item uses any version. Formula history is preserved."
                  onAction={() => archiveRecipe(accessToken, organizationId, recipe.id, recipe.version)}
                  onChanged={reload}
                  title={`Archive ${recipe.name}?`}
                  variant="danger"
                >
                  Archive
                </ActionDialog>
              </div>
            ) : <span className="recipe-status recipe-status--retired">ARCHIVED</span>}
          </div>

          <div className="recipe-history-heading">
            <div>
              <h2>Formula history</h2>
              <p className="staff-muted">Published formulas stay immutable for menu and order history.</p>
            </div>
            {!recipe.archived && !hasDraft ? (
              <ActionDialog
                actionLabel="Create next draft"
                description="The latest published formula is copied into one new editable draft."
                onAction={() => createRecipeVersion(
                  accessToken, organizationId, recipe.id, recipe.version,
                )}
                onChanged={reload}
                title="Create next draft?"
              >
                New draft
              </ActionDialog>
            ) : null}
          </div>
          {ingredientState.status === "error" ? (
            <p className="form-message form-message--error" role="alert">
              Active ingredients could not be loaded. Formula editing is temporarily unavailable.
            </p>
          ) : null}
          <section aria-label="Recipe versions" className="recipe-version-list">
            {recipe.versions.map((version) => (
              <VersionCard
                accessToken={accessToken}
                canEditFormula={ingredientState.status === "ready"}
                ingredients={ingredients}
                key={version.id}
                onChanged={reload}
                organizationId={organizationId}
                recipe={recipe}
                version={version}
              />
            ))}
          </section>
        </>
      )}
    </main>
  );
}
