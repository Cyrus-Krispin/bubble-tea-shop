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
  createOptionGroup,
  getOptionGroups,
  MenuError,
  type OptionGroupPage,
  type OptionGroupSummary,
} from "./menuClient";

const PAGE_SIZE = 25;

function selectionRule(minimum: number, maximum: number) {
  if (minimum === 0 && maximum === 1) return "Optional · choose one";
  if (minimum === 1 && maximum === 1) return "Choose one";
  if (minimum === 0) return `Choose up to ${maximum}`;
  if (minimum === maximum) return `Choose ${minimum}`;
  return `Choose ${minimum}–${maximum}`;
}
type ListState =
  | { status: "loading" }
  | { status: "ready"; page: OptionGroupPage }
  | { status: "error" };

function CreateGroupDialog({
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
  const [minimum, setMinimum] = useState("0");
  const [maximum, setMaximum] = useState("1");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const min = Number(minimum);
    const max = Number(maximum);
    const order = Number(displayOrder);
    if (
      name.trim() === "" ||
      ![min, max, order].every(Number.isSafeInteger) ||
      min < 0 ||
      max < min ||
      max > 100 ||
      order < 0
    ) {
      setError(
        "Enter a name and valid selection bounds. Maximum must be at least minimum.",
      );
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await createOptionGroup(accessToken, organizationId, {
        name: name.trim(),
        minimumSelections: min,
        maximumSelections: max,
        displayOrder: order,
      });
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof MenuError && caught.code === "OPTION_CONFLICT"
          ? "That option group name is already in use."
          : "We couldn’t save this option group. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description="Define reusable selection bounds, then add the choices staff can connect to product variants."
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName("");
          setMinimum("0");
          setMaximum("1");
          setDisplayOrder("0");
          setError(undefined);
        }
      }}
      open={open}
      title="Add option group"
      trigger={<Button size="compact">Add option group</Button>}
    >
      <form className="recipe-form" onSubmit={submit}>
        <Field id={`${prefix}-name`} label="Name">
          <input
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        <div className="menu-field-grid">
          <Field id={`${prefix}-minimum`} label="Minimum selections">
            <input
              min="0"
              onChange={(event) => setMinimum(event.target.value)}
              type="number"
              value={minimum}
            />
          </Field>
          <Field id={`${prefix}-maximum`} label="Maximum selections">
            <input
              min="0"
              onChange={(event) => setMaximum(event.target.value)}
              type="number"
              value={maximum}
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
        {error === undefined ? null : (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        <div className="recipe-form-actions">
          <Button
            isLoading={saving}
            loadingLabel="Creating option group"
            type="submit"
          >
            Create option group
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function OptionManagementPage() {
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const [organizationId, setOrganizationId] = useState(
    staffContext.memberships[0]?.organizationId ?? "",
  );
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState<string>();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<ListState>({ status: "loading" });

  useEffect(() => {
    if (organizationId === "") return;
    const controller = new AbortController();
    getOptionGroups(
      accessToken,
      organizationId,
      { includeArchived, page, query, size: PAGE_SIZE },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          if (page > 0 && result.totalPages <= page)
            setPage(Math.max(0, result.totalPages - 1));
          else setState({ status: "ready", page: result });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [
    accessToken,
    includeArchived,
    organizationId,
    page,
    query,
    reloadVersion,
  ]);

  const columns: readonly DataTableColumn<OptionGroupSummary>[] = [
    { key: "name", header: "Option group" },
    {
      key: "bounds",
      header: "Selections",
      cell: (row) => selectionRule(row.minimumSelections, row.maximumSelections),
    },
    { key: "activeChoiceCount", header: "Active choices" },
    {
      key: "archived",
      header: "Status",
      cell: (row) => <span className={`staff-record-status staff-record-status--${row.archived ? "archived" : "active"}`}>{row.archived ? "Archived" : "Active"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "end",
      cell: (row) => (
        <Button asChild size="compact" variant="outline"><Link to={`/staff/catalog/options/${row.id}?organizationId=${encodeURIComponent(organizationId)}`}>Open group</Link></Button>
      ),
    },
  ];

  if (organizationId === "")
    return (
      <main
        aria-label="Option management"
        className="staff-main"
        id="staff-workspace"
      >
        <ProblemState
          title="No catalog scope"
          message="No active organization is available for option management."
        />
      </main>
    );
  return (
    <main
      aria-label="Option management"
      className="staff-main"
      id="staff-workspace"
    >
      <CatalogSectionNav />
      <div className="ingredient-page-heading">
        <div>
          <p className="eyebrow">Catalog management</p>
          <h1>Options</h1>
          <p className="staff-muted">
            Define reusable choices and safe selection rules.
          </p>
        </div>
        <CreateGroupDialog
          accessToken={accessToken}
          onSaved={() => setReloadVersion((value) => value + 1)}
          organizationId={organizationId}
        />
      </div>
      <section aria-label="Option filters" className="ingredient-toolbar">
        <SelectField
          id="option-organization"
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
        <form
          className="ingredient-search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(queryInput.trim() || undefined);
            setPage(0);
            setReloadVersion((value) => value + 1);
          }}
        >
          <Field id="option-query" label="Search">
            <input
              maxLength={160}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Option group name"
              type="search"
              value={queryInput}
            />
          </Field>
          <Button size="compact" type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <label className="ingredient-archive-filter">
          <Checkbox
            checked={includeArchived}
            onCheckedChange={(checked) => {
              setIncludeArchived(checked === true);
              setPage(0);
            }}
          />
          Include archived
        </label>
      </section>
      {state.status === "loading" ? (
        <p role="status">Loading option groups…</p>
      ) : null}
      {state.status === "error" ? (
        <ProblemState
          title="Options unavailable"
          message="We couldn’t load option groups for this organization."
          onRetry={() => setReloadVersion((value) => value + 1)}
        />
      ) : null}
      {state.status === "ready" ? (
        <div className="ingredient-results">
          <DataTable
            caption={`${state.page.totalItems} option group${state.page.totalItems === 1 ? "" : "s"}`}
            columns={columns}
            emptyMessage="No option groups match these filters."
            getRowKey={(row) => row.id}
            rows={state.page.items}
          />
          <Pagination
            currentPage={state.page.page + 1}
            label="Option group pages"
            onPageChange={(next) => setPage(next - 1)}
            totalPages={state.page.totalPages}
          />
        </div>
      ) : null}
    </main>
  );
}
