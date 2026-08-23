import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import {
  Button,
  DataTable,
  Dialog,
  Field,
  Pagination,
  ProblemState,
  type DataTableColumn,
} from "../../components/ui";
import type { StaffLocation } from "./staffClient";
import type { StaffOutletContext } from "./StaffLayout";
import {
  addOrReactivateManager,
  deactivateManager,
  listManagers,
  ManagerError,
  replaceManagerAssignments,
  type ManagerPage,
  type ManagerSummary,
} from "./managerClient";

const PAGE_SIZE = 25;

type PageState =
  | { status: "loading" }
  | { status: "ready"; page: ManagerPage }
  | { status: "error" };

function managerError(error: unknown) {
  if (error instanceof ManagerError) {
    if (error.code === "MANAGER_ACCOUNT_NOT_FOUND")
      return "That email has no enabled registered customer account yet.";
    if (error.code === "MANAGER_VERSION_CONFLICT")
      return "This manager changed. Refresh the list before trying again.";
    if (error.code === "MANAGER_CONFLICT")
      return "That account already has active access or cannot be changed in its current state.";
    if (error.code === "MANAGER_INVALID")
      return "Choose at least one valid location and check the account email.";
    if (error.code === "STAFF_ACCESS_DENIED")
      return "Your current access no longer permits owner management.";
  }
  return "We couldn’t save this access change. Nothing was partially applied.";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ManagerManagementPage() {
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const ownerMemberships = staffContext.memberships.filter((membership) => membership.role === "OWNER");
  const [organizationId, setOrganizationId] = useState(ownerMemberships[0]?.organizationId ?? "");
  const [pageNumber, setPageNumber] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [newLocations, setNewLocations] = useState<readonly string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const membership = ownerMemberships.find((item) => item.organizationId === organizationId);

  useEffect(() => {
    if (organizationId === "") return;
    const controller = new AbortController();
    listManagers(
      accessToken,
      organizationId,
      { page: pageNumber, size: PAGE_SIZE },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (pageNumber > 0 && result.totalPages <= pageNumber) {
          setPageNumber(Math.max(0, result.totalPages - 1));
        } else setPageState({ status: "ready", page: result });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPageState({ status: "error" });
      });
    return () => controller.abort();
  }, [accessToken, organizationId, pageNumber, reloadVersion]);

  function refresh() {
    setPageState({ status: "loading" });
    setReloadVersion((value) => value + 1);
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (saving || newLocations.length === 0) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await addOrReactivateManager(accessToken, organizationId, {
        email: email.trim().toLowerCase(),
        locationIds: newLocations,
      });
      setEmail("");
      setNewLocations([]);
      refresh();
    } catch (error) {
      setSaveError(managerError(error));
    } finally {
      setSaving(false);
    }
  }

  const columns = useMemo<readonly DataTableColumn<ManagerSummary>[]>(() => [
    { key: "email", header: "Manager", cell: (manager) => <strong>{manager.email}</strong> },
    {
      key: "active",
      header: "Access",
      cell: (manager) => (
        <span className={`manager-status manager-status--${manager.active ? "active" : "inactive"}`}>
          {manager.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "locations",
      header: "Locations",
      cell: (manager) => manager.locations.length === 0
        ? "—"
        : manager.locations.map((location) => location.name).join(", "),
    },
    { key: "updatedAt", header: "Last changed", cell: (manager) => formatDate(manager.updatedAt) },
    {
      key: "actions",
      header: "Actions",
      align: "end",
      cell: (manager) => membership === undefined ? null : (
        <div className="manager-actions">
          {manager.active ? (
            <>
              <AssignmentDialog
                accessToken={accessToken}
                locations={membership.locations}
                manager={manager}
                onSaved={refresh}
                organizationId={organizationId}
              />
              <DeactivateDialog
                accessToken={accessToken}
                manager={manager}
                onSaved={refresh}
                organizationId={organizationId}
              />
            </>
          ) : (
            <ReactivateButton
              accessToken={accessToken}
              locations={membership.locations}
              manager={manager}
              onSaved={refresh}
              organizationId={organizationId}
            />
          )}
        </div>
      ),
    },
  ], [accessToken, membership, organizationId]);

  if (organizationId === "") {
    return (
      <main aria-label="Manager access" className="staff-main" id="staff-workspace">
        <ProblemState
          message="Only an active organization owner can manage manager access."
          title="Owner access required"
        />
      </main>
    );
  }

  return (
    <main aria-label="Manager access" className="staff-main" id="staff-workspace">
      <div className="ingredient-page-heading">
        <div>
          <p className="eyebrow">Owner tools</p>
          <h1>Manager access</h1>
          <p className="staff-muted">Grant registered accounts only the locations they need.</p>
        </div>
      </div>

      <section aria-labelledby="add-manager-title" className="inventory-panel manager-add-panel">
        <div className="inventory-panel-heading">
          <div>
            <p className="card-kicker">Registered accounts</p>
            <h2 id="add-manager-title">Add a manager</h2>
            <p className="staff-muted">The person must create a customer account before you grant access.</p>
          </div>
        </div>
        <form className="manager-form" onSubmit={add}>
          <Field id="manager-organization" label="Organization">
            <select
              onChange={(event) => {
                setOrganizationId(event.target.value);
                setPageNumber(0);
                setNewLocations([]);
                setPageState({ status: "loading" });
              }}
              value={organizationId}
            >
              {ownerMemberships.map((item) => (
                <option key={item.organizationId} value={item.organizationId}>{item.organizationName}</option>
              ))}
            </select>
          </Field>
          <Field id="manager-email" label="Registered email">
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="manager@example.com"
              required
              type="email"
              value={email}
            />
          </Field>
          <LocationChoices
            legend="Initial locations"
            locations={membership?.locations ?? []}
            onChange={setNewLocations}
            selected={newLocations}
          />
          {saveError === undefined ? null : <p className="form-message form-message--error" role="alert">{saveError}</p>}
          <Button disabled={saving || newLocations.length === 0} type="submit">
            {saving ? "Granting access…" : "Grant manager access"}
          </Button>
        </form>
      </section>

      <section aria-labelledby="manager-list-title" className="inventory-panel">
        <div className="inventory-panel-heading">
          <div>
            <p className="card-kicker">Current and historical</p>
            <h2 id="manager-list-title">Managers</h2>
          </div>
          <Button onClick={refresh} size="compact" variant="secondary">Refresh</Button>
        </div>
        {pageState.status === "loading" ? <p role="status">Loading managers…</p> : null}
        {pageState.status === "error" ? (
          <ProblemState
            message="We couldn’t load manager access for this organization."
            onRetry={refresh}
            title="Managers unavailable"
          />
        ) : null}
        {pageState.status === "ready" ? (
          <div className="ingredient-results">
            <DataTable
              caption={`${pageState.page.totalItems} manager${pageState.page.totalItems === 1 ? "" : "s"}`}
              columns={columns}
              emptyMessage="No managers have been added."
              getRowKey={(manager) => manager.id}
              rows={pageState.page.items}
            />
            <Pagination
              currentPage={pageState.page.page + 1}
              label="Manager pages"
              onPageChange={(next) => {
                setPageState({ status: "loading" });
                setPageNumber(next - 1);
              }}
              totalPages={pageState.page.totalPages}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function LocationChoices({
  legend,
  locations,
  onChange,
  selected,
}: {
  legend: string;
  locations: readonly StaffLocation[];
  onChange: (ids: readonly string[]) => void;
  selected: readonly string[];
}) {
  return (
    <fieldset className="manager-location-choices">
      <legend>{legend}</legend>
      {locations.map((location) => (
        <label key={location.id}>
          <input
            checked={selected.includes(location.id)}
            onChange={(event) => onChange(event.target.checked
              ? [...selected, location.id]
              : selected.filter((id) => id !== location.id))}
            type="checkbox"
          />
          <span>{location.name}</span>
        </label>
      ))}
      {locations.length === 0 ? <p className="staff-muted">No active locations are available.</p> : null}
    </fieldset>
  );
}

function AssignmentDialog({
  accessToken,
  locations,
  manager,
  onSaved,
  organizationId,
}: {
  accessToken: string;
  locations: readonly StaffLocation[];
  manager: ManagerSummary;
  onSaved: () => void;
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<readonly string[]>(manager.locations.map((location) => location.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    if (saving || selected.length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      await replaceManagerAssignments(
        accessToken, organizationId, manager.id, manager.version, selected,
      );
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(managerError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description={`Replace the complete location scope for ${manager.email}.`}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSelected(manager.locations.map((location) => location.id));
          setError(undefined);
        }
      }}
      open={open}
      title="Edit manager access"
      trigger={<Button size="compact" variant="secondary">Edit access</Button>}
    >
      <div className="manager-dialog-body">
        <LocationChoices legend="Assigned locations" locations={locations} onChange={setSelected} selected={selected} />
        {error === undefined ? null : <p className="form-message form-message--error" role="alert">{error}</p>}
        <Button disabled={saving || selected.length === 0} onClick={save}>
          {saving ? "Saving access…" : "Save access"}
        </Button>
      </div>
    </Dialog>
  );
}

function DeactivateDialog({ accessToken, manager, onSaved, organizationId }: {
  accessToken: string;
  manager: ManagerSummary;
  onSaved: () => void;
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function deactivate() {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await deactivateManager(accessToken, organizationId, manager.id, manager.version);
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(managerError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description={`${manager.email} will immediately lose staff access. Historical assignments and audit events remain.`}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
      open={open}
      title="Deactivate manager?"
      trigger={<Button size="compact" variant="danger">Deactivate</Button>}
    >
      <div className="manager-dialog-body">
        {error === undefined ? null : <p className="form-message form-message--error" role="alert">{error}</p>}
        <Button disabled={saving} onClick={deactivate} variant="danger">
          {saving ? "Deactivating…" : "Confirm deactivation"}
        </Button>
      </div>
    </Dialog>
  );
}

function ReactivateButton({ accessToken, locations, manager, onSaved, organizationId }: {
  accessToken: string;
  locations: readonly StaffLocation[];
  manager: ManagerSummary;
  onSaved: () => void;
  organizationId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const activeLocationIds = manager.locations
    .filter((assigned) => locations.some((location) => location.id === assigned.id))
    .map((location) => location.id);

  async function reactivate() {
    if (saving || activeLocationIds.length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      await addOrReactivateManager(accessToken, organizationId, {
        email: manager.email,
        locationIds: activeLocationIds,
      });
      onSaved();
    } catch (caught) {
      setError(managerError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Button disabled={saving || activeLocationIds.length === 0} onClick={reactivate} size="compact" variant="secondary">
        {saving ? "Reactivating…" : "Reactivate"}
      </Button>
      {error === undefined ? null : <p className="manager-inline-error" role="alert">{error}</p>}
    </div>
  );
}
