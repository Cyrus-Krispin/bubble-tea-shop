import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useOutletContext } from "react-router";

import {
  DataTable,
  Dialog,
  Field,
  Pagination,
  ProblemState,
  SelectField,
  type DataTableColumn,
} from "../../components/shared";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { CatalogSectionNav } from "./CatalogSectionNav";
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
    {
      key: "latestStatus",
      header: "Formula status",
      cell: (row) => <span className={`recipe-status recipe-status--${row.latestStatus.toLowerCase()}`}>{row.latestStatus.charAt(0) + row.latestStatus.slice(1).toLowerCase()}</span>,
    },
    {
      key: "archived",
      header: "Recipe status",
      cell: (row) => <span className={`staff-record-status staff-record-status--${row.archived ? "archived" : "active"}`}>{row.archived ? "Archived" : "Active"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "end",
      cell: (row) => (
        <Button asChild size="compact" variant="outline"><Link to={`/staff/catalog/recipes/${row.id}?organizationId=${encodeURIComponent(organizationId)}`}>Open recipe</Link></Button>
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
      <CatalogSectionNav />
      <div className="ingredient-page-heading">
        <div>
          <p className="eyebrow">Catalog management</p>
          <h1>Recipes</h1>
          <p className="staff-muted">Version formulas without rewriting menus or historical orders.</p>
        </div>
        <RecipeFormDialog accessToken={accessToken} onSaved={reload} organizationId={organizationId} />
      </div>

      <section aria-label="Recipe filters" className="ingredient-toolbar">
        <SelectField
          id="recipe-organization"
          label="Organization"
          onValueChange={(nextOrganizationId) => {
            setOrganizationId(nextOrganizationId);
            setPage(0);
          }}
          options={staffContext.memberships.map((membership) => ({
            label: membership.organizationName,
            value: membership.organizationId,
          }))}
          value={organizationId}
        />
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
          <Checkbox checked={includeArchived} onCheckedChange={(checked) => {
            setIncludeArchived(checked === true);
            setPage(0);
          }} />
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
