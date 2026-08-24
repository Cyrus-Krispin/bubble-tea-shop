import {
  useEffect,
  useId,
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
import { CatalogSectionNav } from "./CatalogSectionNav";
import type { StaffOutletContext } from "./StaffLayout";
import {
  archiveOptionChoice,
  archiveOptionGroup,
  createOptionChoice,
  getOptionGroup,
  MenuError,
  updateOptionChoice,
  updateOptionGroup,
  type OptionChoice,
  type OptionGroup,
} from "./menuClient";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; group: OptionGroup }
  | { status: "error" };

function optionMessage(error: unknown) {
  if (error instanceof MenuError) {
    if (error.code === "OPTION_VERSION_CONFLICT")
      return "This option changed since you opened it. The latest data has been reloaded.";
    if (error.code === "OPTION_STATE_CONFLICT")
      return "This change would invalidate an available menu item. Make affected offerings unavailable first.";
    if (error.code === "OPTION_CONFLICT")
      return "That option name is already in use.";
    if (error.code === "OPTION_INVALID")
      return "Check the option details and selection bounds.";
    if (error.code === "OPTION_NOT_FOUND")
      return "This option is no longer available in this organization.";
  }
  return "We couldn’t save this option. Try again.";
}

function shouldReload(error: unknown) {
  return (
    error instanceof MenuError &&
    (error.code === "OPTION_VERSION_CONFLICT" ||
      error.code === "OPTION_STATE_CONFLICT")
  );
}

function GroupDialog({
  accessToken,
  group,
  onChanged,
  organizationId,
}: {
  accessToken: string;
  group: OptionGroup;
  onChanged: () => void;
  organizationId: string;
}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [minimum, setMinimum] = useState(String(group.minimumSelections));
  const [maximum, setMaximum] = useState(String(group.maximumSelections));
  const [displayOrder, setDisplayOrder] = useState(String(group.displayOrder));
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
      setError("Enter valid details. Maximum must be at least minimum.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await updateOptionGroup(accessToken, organizationId, group.id, {
        name: name.trim(),
        minimumSelections: min,
        maximumSelections: max,
        displayOrder: order,
        version: group.version,
      });
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(optionMessage(caught));
      if (shouldReload(caught)) onChanged();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      description="Selection bounds apply whenever this group has enabled choices on an available variant."
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(group.name);
          setMinimum(String(group.minimumSelections));
          setMaximum(String(group.maximumSelections));
          setDisplayOrder(String(group.displayOrder));
          setError(undefined);
        }
      }}
      open={open}
      title="Edit option group"
      trigger={
        <Button size="compact" variant="secondary">
          Edit group
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
        <div className="menu-field-grid">
          <Field id={`${prefix}-min`} label="Minimum">
            <input
              min="0"
              onChange={(event) => setMinimum(event.target.value)}
              type="number"
              value={minimum}
            />
          </Field>
          <Field id={`${prefix}-max`} label="Maximum">
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
            loadingLabel="Saving option group"
            type="submit"
          >
            Save group
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ChoiceDialog({
  accessToken,
  choice,
  group,
  onChanged,
  organizationId,
}: {
  accessToken: string;
  choice?: OptionChoice;
  group: OptionGroup;
  onChanged: () => void;
  organizationId: string;
}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(choice?.name ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    String(choice?.displayOrder ?? 0),
  );
  const [defaultChoice, setDefaultChoice] = useState(
    choice?.defaultChoice ?? false,
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
      const body = { name: name.trim(), displayOrder: order, defaultChoice };
      if (choice === undefined)
        await createOptionChoice(accessToken, organizationId, group.id, body);
      else
        await updateOptionChoice(
          accessToken,
          organizationId,
          group.id,
          choice.id,
          { ...body, version: choice.version },
        );
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(optionMessage(caught));
      if (shouldReload(caught)) onChanged();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      description="A default choice is selected automatically when this group is required on a variant."
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(choice?.name ?? "");
          setDisplayOrder(String(choice?.displayOrder ?? 0));
          setDefaultChoice(choice?.defaultChoice ?? false);
          setError(undefined);
        }
      }}
      open={open}
      title={choice === undefined ? "Add choice" : `Edit ${choice.name}`}
      trigger={
        <Button
          size="compact"
          variant={choice === undefined ? "primary" : "secondary"}
        >
          {choice === undefined ? "Add choice" : "Edit"}
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
            checked={defaultChoice}
            onChange={(event) => setDefaultChoice(event.target.checked)}
            type="checkbox"
          />
          Default choice
        </label>
        {error === undefined ? null : (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        <div className="recipe-form-actions">
          <Button isLoading={saving} loadingLabel="Saving choice" type="submit">
            Save choice
          </Button>
        </div>
      </form>
    </Dialog>
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
      setError(optionMessage(caught));
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

export default function OptionGroupDetailPage() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const requestedOrganization = searchParams.get("organizationId");
  const organizationId = staffContext.memberships.some(
    (membership) => membership.organizationId === requestedOrganization,
  )
    ? requestedOrganization!
    : (staffContext.memberships[0]?.organizationId ?? "");
  const [includeArchivedChoices, setIncludeArchivedChoices] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  useEffect(() => {
    if (!groupId || organizationId === "") return;
    const controller = new AbortController();
    getOptionGroup(
      accessToken,
      organizationId,
      groupId,
      includeArchivedChoices,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted)
          setState({ status: "ready", group: result });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [
    accessToken,
    groupId,
    includeArchivedChoices,
    organizationId,
    reloadVersion,
  ]);
  const reload = () => setReloadVersion((value) => value + 1);
  if (!groupId || organizationId === "")
    return (
      <main
        aria-label="Option group detail"
        className="staff-main"
        id="staff-workspace"
      >
        <ProblemState
          title="Option group unavailable"
          message="A valid catalog scope is required."
        />
      </main>
    );
  if (state.status === "loading")
    return (
      <main
        aria-label="Option group detail"
        className="staff-main"
        id="staff-workspace"
      >
        <p role="status">Loading option group…</p>
      </main>
    );
  if (state.status === "error")
    return (
      <main
        aria-label="Option group detail"
        className="staff-main"
        id="staff-workspace"
      >
        <ProblemState
          title="Option group unavailable"
          message="We couldn’t load this option group."
          onRetry={reload}
        />
      </main>
    );
  const { group } = state;
  return (
    <main
      aria-label="Option group detail"
      className="staff-main"
      id="staff-workspace"
    >
      <CatalogSectionNav />
      <Link className="staff-back-link" to={`/staff/catalog/options?organizationId=${encodeURIComponent(organizationId)}`}>
        ← Back to options
      </Link>
      <div className="recipe-detail-heading">
        <div>
          <p className="eyebrow">Option group</p>
          <h1>{group.name}</h1>
          <p className="staff-muted">
            Choose {group.minimumSelections}–{group.maximumSelections} · display
            order {group.displayOrder} ·{" "}
            {group.archived ? "archived" : "active"}
          </p>
        </div>
        {group.archived ? null : (
          <div className="recipe-row-actions">
            <GroupDialog
              accessToken={accessToken}
              group={group}
              onChanged={reload}
              organizationId={organizationId}
            />
            <ConfirmDialog
              description="Archived groups remain on historical orders and cannot participate in new configurations."
              onAction={() =>
                archiveOptionGroup(
                  accessToken,
                  organizationId,
                  group.id,
                  group.version,
                )
              }
              onChanged={reload}
              title={`Archive ${group.name}?`}
            >
              Archive group
            </ConfirmDialog>
          </div>
        )}
      </div>
      <dl className="staff-summary-strip" aria-label="Option group summary">
        <div><dt>Group status</dt><dd>{group.archived ? "Archived" : "Active"}</dd></div>
        <div><dt>Selection rule</dt><dd>{group.minimumSelections === 0 ? `Choose up to ${group.maximumSelections}` : group.minimumSelections === group.maximumSelections ? `Choose ${group.maximumSelections}` : `Choose ${group.minimumSelections}–${group.maximumSelections}`}</dd></div>
        <div><dt>Choices</dt><dd>{group.choices.filter((choice) => !choice.archived).length} active</dd></div>
      </dl>
      <section aria-labelledby="choices-title">
        <div className="recipe-history-heading">
          <div>
            <h2 id="choices-title">Choices</h2>
            <label className="ingredient-archive-filter">
              <input
                checked={includeArchivedChoices}
                onChange={(event) =>
                  setIncludeArchivedChoices(event.target.checked)
                }
                type="checkbox"
              />
              Include archived
            </label>
          </div>
          {group.archived ? null : (
            <ChoiceDialog
              accessToken={accessToken}
              group={group}
              onChanged={reload}
              organizationId={organizationId}
            />
          )}
        </div>
        <div className="option-choice-list">
          {group.choices.length === 0 ? (
            <p className="staff-muted">No choices yet.</p>
          ) : (
            group.choices.map((choice) => (
              <article className="option-choice-card" key={choice.id}>
                <div>
                  <h3>{choice.name}</h3>
                  <p className="staff-muted">
                    Order {choice.displayOrder}
                    {choice.defaultChoice ? " · default" : ""}
                    {choice.archived ? " · archived" : ""}
                  </p>
                </div>
                {group.archived || choice.archived ? null : (
                  <div className="recipe-row-actions">
                    <ChoiceDialog
                      accessToken={accessToken}
                      choice={choice}
                      group={group}
                      onChanged={reload}
                      organizationId={organizationId}
                    />
                    <ConfirmDialog
                      description="Archived choices remain in historical orders. Active menu configurations may block this action."
                      onAction={() =>
                        archiveOptionChoice(
                          accessToken,
                          organizationId,
                          group.id,
                          choice.id,
                          choice.version,
                        )
                      }
                      onChanged={reload}
                      title={`Archive ${choice.name}?`}
                    >
                      Archive
                    </ConfirmDialog>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
