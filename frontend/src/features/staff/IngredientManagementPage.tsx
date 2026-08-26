import { useEffect, useId, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router";

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
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { Checkbox } from "../../components/ui/checkbox";
import { CatalogSectionNav } from "./CatalogSectionNav";
import type { StaffOutletContext } from "./StaffLayout";
import {
  archiveIngredient,
  createIngredient,
  getIngredients,
  IngredientError,
  updateIngredient,
  type BaseUnit,
  type Ingredient,
  type IngredientPage,
} from "./ingredientClient";

const PAGE_SIZE = 25;
const QUANTITY_PATTERN = /^(0|[0-9]+)(\.[0-9]{1,6})?$/;

type ListState =
  | { status: "loading" }
  | { status: "ready"; page: IngredientPage }
  | { status: "error"; error: unknown };

type FormValues = {
  baseUnit: BaseUnit;
  name: string;
  reorderThreshold: string;
  sku: string;
};

function unitLabel(unit: BaseUnit) {
  if (unit === "GRAM") return "Grams";
  if (unit === "MILLILITER") return "Milliliters";
  return "Each";
}

function mutationMessage(error: unknown) {
  if (error instanceof IngredientError) {
    if (error.code === "INGREDIENT_VERSION_CONFLICT") {
      return "This ingredient changed since you opened it. The list has refreshed; close this dialog and try again.";
    }
    if (error.code === "INGREDIENT_CONFLICT") {
      return "That ingredient name or SKU is already in use.";
    }
    if (error.code === "INGREDIENT_INVALID") return "Check the ingredient details and try again.";
    if (error.code === "INGREDIENT_NOT_FOUND") return "This ingredient is no longer available.";
  }
  return "We couldn’t save this ingredient. Try again.";
}

function IngredientFormDialog({
  accessToken,
  ingredient,
  onSaved,
  organizationId,
}: {
  accessToken: string;
  ingredient?: Ingredient;
  onSaved: () => void;
  organizationId: string;
}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>({
    baseUnit: ingredient?.baseUnit ?? "GRAM",
    name: ingredient?.name ?? "",
    reorderThreshold: ingredient?.reorderThreshold ?? "",
    sku: ingredient?.sku ?? "",
  });
  const [nameError, setNameError] = useState<string>();
  const [thresholdError, setThresholdError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [saving, setSaving] = useState(false);

  function reset() {
    setValues({
      baseUnit: ingredient?.baseUnit ?? "GRAM",
      name: ingredient?.name ?? "",
      reorderThreshold: ingredient?.reorderThreshold ?? "",
      sku: ingredient?.sku ?? "",
    });
    setNameError(undefined);
    setThresholdError(undefined);
    setSubmitError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = values.name.trim();
    const threshold = values.reorderThreshold.trim();
    const invalidName = name.length === 0 ? "Enter an ingredient name." : undefined;
    const invalidThreshold = threshold !== "" && !QUANTITY_PATTERN.test(threshold)
      ? "Use a non-negative quantity with up to 6 decimal places."
      : undefined;
    setNameError(invalidName);
    setThresholdError(invalidThreshold);
    setSubmitError(undefined);
    if (invalidName !== undefined || invalidThreshold !== undefined) return;

    setSaving(true);
    try {
      const common = {
        name,
        sku: values.sku.trim() || null,
        reorderThreshold: threshold || null,
      };
      if (ingredient === undefined) {
        await createIngredient(accessToken, organizationId, {
          ...common,
          baseUnit: values.baseUnit,
        });
      } else {
        await updateIngredient(accessToken, organizationId, ingredient.id, {
          ...common,
          version: ingredient.version,
        });
      }
      setOpen(false);
      onSaved();
    } catch (error) {
      setSubmitError(mutationMessage(error));
      if (error instanceof IngredientError && error.code === "INGREDIENT_VERSION_CONFLICT") {
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description={ingredient === undefined
        ? "Add a stock item and choose the unit all recipes will use."
        : "Update the stock item. Its base unit stays fixed to protect recipe quantities."}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
      open={open}
      title={ingredient === undefined ? "Add ingredient" : `Edit ${ingredient.name}`}
      trigger={<Button size="compact" variant={ingredient === undefined ? "primary" : "secondary"}>{ingredient === undefined ? "Add ingredient" : "Edit"}</Button>}
    >
      <form className="ingredient-form" onSubmit={submit}>
        <Field error={nameError} id={`${prefix}-name`} label="Name">
          <input maxLength={160} onChange={(event) => setValues({ ...values, name: event.target.value })} required value={values.name} />
        </Field>
        <Field id={`${prefix}-sku`} label="SKU" description="Optional. It will be saved in uppercase.">
          <input maxLength={80} onChange={(event) => setValues({ ...values, sku: event.target.value })} value={values.sku} />
        </Field>
        <SelectField
          description={ingredient === undefined ? "This cannot be changed later." : "Base units are immutable after creation."}
          disabled={ingredient !== undefined}
          id={`${prefix}-unit`}
          label="Base unit"
          onValueChange={(baseUnit) => setValues({ ...values, baseUnit: baseUnit as BaseUnit })}
          options={[
            { label: "Grams", value: "GRAM" },
            { label: "Milliliters", value: "MILLILITER" },
            { label: "Each", value: "EACH" },
          ]}
          value={values.baseUnit}
        />
        <Field error={thresholdError} id={`${prefix}-threshold`} label="Reorder threshold" description="Optional quantity with up to 6 decimal places.">
          <input inputMode="decimal" onChange={(event) => setValues({ ...values, reorderThreshold: event.target.value })} value={values.reorderThreshold} />
        </Field>
        {submitError === undefined ? null : <p className="form-message form-message--error" role="alert">{submitError}</p>}
        <div className="ingredient-form-actions">
          <Button isLoading={saving} loadingLabel="Saving ingredient" type="submit">
            {ingredient === undefined ? "Create ingredient" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ArchiveIngredientDialog({
  accessToken,
  ingredient,
  onArchived,
  organizationId,
}: {
  accessToken: string;
  ingredient: Ingredient;
  onArchived: () => void;
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function archive() {
    setSaving(true);
    setError(undefined);
    try {
      await archiveIngredient(accessToken, organizationId, ingredient.id, ingredient.version);
      setOpen(false);
      onArchived();
    } catch (caught) {
      setError(mutationMessage(caught));
      if (caught instanceof IngredientError && caught.code === "INGREDIENT_VERSION_CONFLICT") {
        onArchived();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConfirmDialog
      confirmLabel="Archive ingredient"
      description="Archived ingredients leave active lists but remain in historical recipes, orders, and audit records."
      error={error}
      isLoading={saving}
      onConfirm={archive}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(undefined);
      }}
      open={open}
      title={`Archive ${ingredient.name}?`}
      trigger={<Button size="compact" variant="danger">Archive</Button>}
    />
  );
}

export default function IngredientManagementPage() {
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
    getIngredients(accessToken, organizationId, {
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

  const columns: readonly DataTableColumn<Ingredient>[] = [
    { key: "name", header: "Ingredient" },
    { key: "sku", header: "SKU" },
    { key: "baseUnit", header: "Base unit", cell: (row) => unitLabel(row.baseUnit) },
    { key: "reorderThreshold", header: "Reorder at" },
    {
      key: "archived",
      header: "Status",
      cell: (row) => <span className={`staff-record-status staff-record-status--${row.archived ? "archived" : "active"}`}>{row.archived ? "Archived" : "Active"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "end",
      cell: (row) => row.archived ? null : (
        <div className="ingredient-row-actions">
          <IngredientFormDialog accessToken={accessToken} ingredient={row} onSaved={reload} organizationId={organizationId} />
          <ArchiveIngredientDialog accessToken={accessToken} ingredient={row} onArchived={reload} organizationId={organizationId} />
        </div>
      ),
    },
  ];

  if (organizationId === "") {
    return (
      <main aria-label="Ingredient management" className="staff-main" id="staff-workspace">
        <ProblemState title="No catalog scope" message="No active organization is available for ingredient management." />
      </main>
    );
  }

  return (
    <main aria-label="Ingredient management" className="staff-main" id="staff-workspace">
      <CatalogSectionNav />
      <div className="ingredient-page-heading">
        <div>
          <p className="eyebrow">Catalog management</p>
          <h1>Ingredients</h1>
          <p className="staff-muted">Manage recipe stock items without changing historical records.</p>
        </div>
        <IngredientFormDialog accessToken={accessToken} onSaved={reload} organizationId={organizationId} />
      </div>

      <section aria-label="Ingredient filters" className="ingredient-toolbar">
        <SelectField
          id="ingredient-organization"
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
          <Field id="ingredient-query" label="Search">
            <input maxLength={160} onChange={(event) => setQueryInput(event.target.value)} placeholder="Name or SKU" type="search" value={queryInput} />
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

      {listState.status === "loading" ? <p role="status">Loading ingredients…</p> : null}
      {listState.status === "error" ? (
        <ProblemState
          title="Ingredients unavailable"
          message="We couldn’t load ingredients for this organization."
          onRetry={() => {
            setListState({ status: "loading" });
            reload();
          }}
        />
      ) : null}
      {listState.status === "ready" ? (
        <div className="ingredient-results">
          <DataTable
            caption={`${listState.page.totalItems} ingredient${listState.page.totalItems === 1 ? "" : "s"}`}
            columns={columns}
            emptyMessage="No ingredients match these filters."
            getRowKey={(row) => row.id}
            rows={listState.page.items}
          />
          <Pagination
            currentPage={listState.page.page + 1}
            label="Ingredient pages"
            onPageChange={(nextPage) => setPage(nextPage - 1)}
            totalPages={listState.page.totalPages}
          />
        </div>
      ) : null}
    </main>
  );
}
