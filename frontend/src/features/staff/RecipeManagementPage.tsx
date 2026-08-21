import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useOutletContext } from "react-router";

import {
  Button,
  DataTable,
  Dialog,
  Field,
  Pagination,
  ProblemState,
  type DataTableColumn,
} from "../../components/ui";
import type { StaffOutletContext } from "./StaffLayout";
import {
  createRecipe,
  getRecipes,
  RecipeError,
  type RecipePage,
  type RecipeSummary,
} from "./recipeClient";

const PAGE_SIZE = 25;

type ListState =
  | { status: "loading" }
  | { status: "ready"; page: RecipePage }
  | { status: "error"; error: unknown };

function mutationMessage(error: unknown) {
  if (error instanceof RecipeError) {
    if (error.code === "RECIPE_CONFLICT") return "That recipe name is already in use.";
    if (error.code === "RECIPE_INVALID") return "Check the recipe details and try again.";
  }
  return "We couldn’t save this recipe. Try again.";
}

function RecipeFormDialog({
  accessToken,
  onSaved,
  organizationId,
}: {
  accessToken: string;
  onSaved: () => void;
  organizationId: string;
}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName === "") {
      setNameError("Enter a recipe name.");
      return;
    }
    setNameError(undefined);
    setSubmitError(undefined);
    setSaving(true);
    try {
      await createRecipe(accessToken, organizationId, {
        name: normalizedName,
        description: description.trim() || null,
      });
      setOpen(false);
      onSaved();
    } catch (error) {
      setSubmitError(mutationMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description="Create an empty version 1 draft, then add its ingredient formula."
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setName("");
          setDescription("");
          setNameError(undefined);
          setSubmitError(undefined);
        }
      }}
      open={open}
      title="Add recipe"
      trigger={<Button size="compact">Add recipe</Button>}
    >
      <form className="recipe-form" onSubmit={submit}>
        <Field error={nameError} id={`${prefix}-name`} label="Name">
          <input maxLength={160} onChange={(event) => setName(event.target.value)} required value={name} />
        </Field>
        <Field id={`${prefix}-description`} label="Description" description="Optional staff-facing notes.">
          <textarea maxLength={4000} onChange={(event) => setDescription(event.target.value)} rows={4} value={description} />
        </Field>
        {submitError === undefined ? null : (
          <p className="form-message form-message--error" role="alert">{submitError}</p>
        )}
        <div className="recipe-form-actions">
          <Button isLoading={saving} loadingLabel="Creating recipe" type="submit">Create recipe</Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function RecipeManagementPage() {
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const [organizationId, setOrganizationId] = useState(
    staffContext.memberships[0]?.organizationId ?? "",
  );
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState<string>();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [listState, setListState] = useState<ListState>({ status: "loading" });

  useEffect(() => {
    if (organizationId === "") return;
    const controller = new AbortController();
    getRecipes(accessToken, organizationId, {
      includeArchived,
      page,
      query,
      size: PAGE_SIZE,
    }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (page > 0 && result.totalPages <= page) {
          setPage(Math.max(0, result.totalPages - 1));
          return;
        }
        setListState({ status: "ready", page: result });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setListState({ status: "error", error });
      });
    return () => controller.abort();
  }, [accessToken, includeArchived, organizationId, page, query, reloadVersion]);

  function reload() {
    setReloadVersion((value) => value + 1);
  }

  const columns: readonly DataTableColumn<RecipeSummary>[] = [
    { key: "name", header: "Recipe" },
    { key: "description", header: "Description" },
    { key: "latestVersionNumber", header: "Latest version", cell: (row) => `v${row.latestVersionNumber}` },
    { key: "latestStatus", header: "Formula status" },
    { key: "archived", header: "Recipe status", cell: (row) => row.archived ? "Archived" : "Active" },
    {
      key: "actions",
      header: "Actions",
      align: "end",
      cell: (row) => (
        <Link
          className="ui-button ui-button--secondary ui-button--compact"
          to={`/staff/catalog/recipes/${row.id}?organizationId=${encodeURIComponent(organizationId)}`}
        >
          Manage
        </Link>
      ),
    },
  ];

  if (organizationId === "") {
    return (
      <main aria-label="Recipe management" className="staff-main" id="staff-workspace">
        <ProblemState title="No catalog scope" message="No active organization is available for recipe management." />
      </main>
    );
  }

  return (
    <main aria-label="Recipe management" className="staff-main" id="staff-workspace">
      <nav aria-label="Catalog sections" className="catalog-section-nav">
        <Link to="/staff/catalog/ingredients">Ingredients</Link>
        <Link aria-current="page" to="/staff/catalog/recipes">Recipes</Link>
      </nav>
      <div className="ingredient-page-heading">
        <div>
          <p className="eyebrow">Catalog management</p>
          <h1>Recipes</h1>
          <p className="staff-muted">Version formulas without rewriting menus or historical orders.</p>
        </div>
        <RecipeFormDialog accessToken={accessToken} onSaved={reload} organizationId={organizationId} />
      </div>

      <section aria-label="Recipe filters" className="ingredient-toolbar">
        <Field id="recipe-organization" label="Organization">
          <select value={organizationId} onChange={(event) => {
            setOrganizationId(event.target.value);
            setPage(0);
          }}>
            {staffContext.memberships.map((membership) => (
              <option key={membership.organizationId} value={membership.organizationId}>
                {membership.organizationName}
              </option>
            ))}
          </select>
        </Field>
        <form className="ingredient-search" onSubmit={(event) => {
          event.preventDefault();
          setQuery(queryInput.trim() || undefined);
          setPage(0);
          reload();
        }}>
          <Field id="recipe-query" label="Search">
            <input maxLength={160} onChange={(event) => setQueryInput(event.target.value)} placeholder="Recipe name" type="search" value={queryInput} />
          </Field>
          <Button size="compact" type="submit" variant="secondary">Search</Button>
        </form>
        <label className="ingredient-archive-filter">
          <input checked={includeArchived} onChange={(event) => {
            setIncludeArchived(event.target.checked);
            setPage(0);
          }} type="checkbox" />
          Include archived
        </label>
      </section>

      {listState.status === "loading" ? <p role="status">Loading recipes…</p> : null}
      {listState.status === "error" ? (
        <ProblemState
          title="Recipes unavailable"
          message="We couldn’t load recipes for this organization."
          onRetry={() => {
            setListState({ status: "loading" });
            reload();
          }}
        />
      ) : null}
      {listState.status === "ready" ? (
        <div className="ingredient-results">
          <DataTable
            caption={`${listState.page.totalItems} recipe${listState.page.totalItems === 1 ? "" : "s"}`}
            columns={columns}
            emptyMessage="No recipes match these filters."
            getRowKey={(row) => row.id}
            rows={listState.page.items}
          />
          <Pagination
            currentPage={listState.page.page + 1}
            label="Recipe pages"
            onPageChange={(nextPage) => setPage(nextPage - 1)}
            totalPages={listState.page.totalPages}
          />
        </div>
      ) : null}
    </main>
  );
}
