import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
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
  getInventoryBalances,
  getInventoryMovements,
  InventoryError,
  recordInventoryMovement,
  type InventoryBalance,
  type InventoryBalancePage,
  type InventoryMovement,
  type InventoryMovementPage,
  type InventoryMovementType,
  type ManualInventoryMovementType,
} from "./inventoryClient";

const PAGE_SIZE = 25;
const SIGNED_QUANTITY_PATTERN = /^-?(0|[0-9]+)(\.[0-9]{1,6})?$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;

type BalanceState =
  | { status: "loading" }
  | { status: "ready"; page: InventoryBalancePage }
  | { status: "error" };

type MovementState =
  | { status: "loading" }
  | { status: "ready"; page: InventoryMovementPage }
  | { status: "error" };

function unitLabel(unit: InventoryBalance["baseUnit"]) {
  if (unit === "GRAM") return "g";
  if (unit === "MILLILITER") return "mL";
  return "each";
}

function movementLabel(type: InventoryMovementType) {
  if (type === "OPENING") return "Opening stock";
  if (type === "RECEIPT") return "Receipt";
  if (type === "SALE") return "Sale";
  if (type === "REVERSAL") return "Reversal";
  return "Adjustment";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function formatMoney(amount: number | null, currencyCode: string | null) {
  if (amount === null || currencyCode === null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
    }).format(amount / 100);
  } catch {
    return `${amount} ${currencyCode} minor units`;
  }
}

function mutationMessage(error: unknown, ingredientId: string) {
  if (error instanceof InventoryError) {
    if (error.code === "INVENTORY_INSUFFICIENT_STOCK") {
      const shortage = error.shortages[ingredientId];
      return shortage === undefined
        ? "There isn’t enough stock for that adjustment. Current inventory has been reloaded."
        : `There isn’t enough stock: ${shortage.requested} requested and ${shortage.available} available. Current inventory has been reloaded.`;
    }
    if (error.code === "INVENTORY_STATE_CONFLICT") {
      return "Inventory changed while you were working. Current inventory has been reloaded; review it and try again.";
    }
    if (error.code === "INVENTORY_NOT_FOUND") {
      return "This ingredient is no longer available at the selected location.";
    }
    if (error.code === "INVENTORY_INVALID") {
      return "Check the movement details and try again.";
    }
  }
  return "We couldn’t record this movement. Try again.";
}

function MovementDialog({
  accessToken,
  balance,
  currencyCode,
  locationId,
  onSaved,
  organizationId,
}: {
  accessToken: string;
  balance: InventoryBalance;
  currencyCode: string;
  locationId: string;
  onSaved: () => void;
  organizationId: string;
}) {
  const prefix = useId();
  const initialType: ManualInventoryMovementType = balance.openingRecorded
    ? "RECEIPT"
    : "OPENING";
  const [open, setOpen] = useState(false);
  const [movementType, setMovementType] =
    useState<ManualInventoryMovementType>(initialType);
  const [quantity, setQuantity] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [note, setNote] = useState("");
  const [totalCostMinor, setTotalCostMinor] = useState("");
  const [quantityError, setQuantityError] = useState<string>();
  const [noteError, setNoteError] = useState<string>();
  const [costError, setCostError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [saving, setSaving] = useState(false);

  function reset() {
    setMovementType(initialType);
    setQuantity("");
    setSourceReference("");
    setNote("");
    setTotalCostMinor("");
    setQuantityError(undefined);
    setNoteError(undefined);
    setCostError(undefined);
    setSubmitError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuantity = quantity.trim();
    const numericQuantity = Number(normalizedQuantity);
    const invalidQuantity =
      !SIGNED_QUANTITY_PATTERN.test(normalizedQuantity) ||
      numericQuantity === 0 ||
      !Number.isFinite(numericQuantity) ||
      (movementType !== "ADJUSTMENT" && numericQuantity < 0)
        ? movementType === "ADJUSTMENT"
          ? "Enter a non-zero signed quantity with up to 6 decimal places."
          : "Enter a positive quantity with up to 6 decimal places."
        : undefined;
    const invalidNote =
      movementType === "ADJUSTMENT" && note.trim() === ""
        ? "Explain why this stock adjustment is needed."
        : undefined;
    const parsedCost =
      totalCostMinor === "" ? undefined : Number(totalCostMinor);
    const invalidCost =
      totalCostMinor !== "" &&
      (!WHOLE_NUMBER_PATTERN.test(totalCostMinor) ||
        !Number.isSafeInteger(parsedCost))
        ? "Enter a non-negative whole number of minor currency units."
        : undefined;

    setQuantityError(invalidQuantity);
    setNoteError(invalidNote);
    setCostError(invalidCost);
    setSubmitError(undefined);
    if (
      invalidQuantity !== undefined ||
      invalidNote !== undefined ||
      invalidCost !== undefined
    )
      return;

    setSaving(true);
    try {
      await recordInventoryMovement(accessToken, organizationId, locationId, {
        ingredientId: balance.ingredientId,
        movementType,
        quantityDelta: normalizedQuantity,
        sourceReference: sourceReference.trim() || undefined,
        note: note.trim() || undefined,
        totalCostMinor: movementType === "RECEIPT" ? parsedCost : undefined,
      });
      setOpen(false);
      onSaved();
    } catch (error) {
      setSubmitError(mutationMessage(error, balance.ingredientId));
      if (
        error instanceof InventoryError &&
        (error.code === "INVENTORY_STATE_CONFLICT" ||
          error.code === "INVENTORY_INSUFFICIENT_STOCK")
      )
        onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description={`Append an immutable movement for ${balance.ingredientName}. Current balance: ${balance.quantity} ${unitLabel(balance.baseUnit)}.`}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
      open={open}
      title="Record stock movement"
      trigger={
        <Button size="compact" variant="secondary">
          Record
        </Button>
      }
    >
      <form className="inventory-movement-form" onSubmit={submit}>
        <Field id={`${prefix}-type`} label="Movement type">
          <select
            onChange={(event) => {
              const next = event.target.value as ManualInventoryMovementType;
              setMovementType(next);
              if (next !== "RECEIPT") setTotalCostMinor("");
            }}
            value={movementType}
          >
            {!balance.openingRecorded ? (
              <option value="OPENING">Opening stock</option>
            ) : null}
            <option value="RECEIPT">Receipt</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
        </Field>
        <Field
          description={
            movementType === "ADJUSTMENT"
              ? "Use a minus sign to remove stock."
              : "Must be greater than zero."
          }
          error={quantityError}
          id={`${prefix}-quantity`}
          label={`Quantity (${unitLabel(balance.baseUnit)})`}
        >
          <input
            inputMode="decimal"
            onChange={(event) => setQuantity(event.target.value)}
            placeholder={movementType === "ADJUSTMENT" ? "-2.5 or 2.5" : "10.5"}
            required
            value={quantity}
          />
        </Field>
        <Field
          id={`${prefix}-reference`}
          label="Source reference"
          description="Optional purchase order, delivery, or audit reference."
        >
          <input
            maxLength={120}
            onChange={(event) => setSourceReference(event.target.value)}
            value={sourceReference}
          />
        </Field>
        <Field
          error={noteError}
          id={`${prefix}-note`}
          label={movementType === "ADJUSTMENT" ? "Adjustment reason" : "Note"}
        >
          <textarea
            maxLength={4000}
            onChange={(event) => setNote(event.target.value)}
            required={movementType === "ADJUSTMENT"}
            rows={3}
            value={note}
          />
        </Field>
        {movementType === "RECEIPT" ? (
          <Field
            description={`Optional whole ${currencyCode} minor units; for example, 1299 means 12.99.`}
            error={costError}
            id={`${prefix}-cost`}
            label={`Total cost (${currencyCode} minor units)`}
          >
            <input
              inputMode="numeric"
              min="0"
              onChange={(event) => setTotalCostMinor(event.target.value)}
              type="number"
              value={totalCostMinor}
            />
          </Field>
        ) : null}
        {submitError === undefined ? null : (
          <p className="form-message form-message--error" role="alert">
            {submitError}
          </p>
        )}
        <div className="recipe-form-actions">
          <Button
            isLoading={saving}
            loadingLabel="Recording movement"
            type="submit"
          >
            Record movement
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function activeLocation(
  memberships: StaffOutletContext["staffContext"]["memberships"],
  organizationId: string,
  locationId: string,
): StaffLocation | undefined {
  return memberships
    .find((membership) => membership.organizationId === organizationId)
    ?.locations.find((location) => location.id === locationId);
}

export default function InventoryManagementPage() {
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const initialMembership = staffContext.memberships[0];
  const [organizationId, setOrganizationId] = useState(
    initialMembership?.organizationId ?? "",
  );
  const [locationId, setLocationId] = useState(
    initialMembership?.locations[0]?.id ?? "",
  );
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState<string>();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [balancePage, setBalancePage] = useState(0);
  const [movementPage, setMovementPage] = useState(0);
  const [movementIngredientId, setMovementIngredientId] = useState<string>();
  const [movementType, setMovementType] = useState<InventoryMovementType>();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [balanceState, setBalanceState] = useState<BalanceState>({
    status: "loading",
  });
  const [movementState, setMovementState] = useState<MovementState>({
    status: "loading",
  });

  const membership = staffContext.memberships.find(
    (item) => item.organizationId === organizationId,
  );
  const location = activeLocation(
    staffContext.memberships,
    organizationId,
    locationId,
  );

  useEffect(() => {
    if (organizationId === "" || locationId === "") return;
    const controller = new AbortController();
    getInventoryBalances(
      accessToken,
      organizationId,
      locationId,
      {
        includeArchived,
        page: balancePage,
        query,
        size: PAGE_SIZE,
      },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (balancePage > 0 && result.totalPages <= balancePage) {
          setBalancePage(Math.max(0, result.totalPages - 1));
        } else setBalanceState({ status: "ready", page: result });
      })
      .catch(() => {
        if (!controller.signal.aborted) setBalanceState({ status: "error" });
      });
    return () => controller.abort();
  }, [
    accessToken,
    balancePage,
    includeArchived,
    locationId,
    organizationId,
    query,
    reloadVersion,
  ]);

  useEffect(() => {
    if (organizationId === "" || locationId === "") return;
    const controller = new AbortController();
    getInventoryMovements(
      accessToken,
      organizationId,
      locationId,
      {
        ingredientId: movementIngredientId,
        movementType,
        page: movementPage,
        size: PAGE_SIZE,
      },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (movementPage > 0 && result.totalPages <= movementPage) {
          setMovementPage(Math.max(0, result.totalPages - 1));
        } else setMovementState({ status: "ready", page: result });
      })
      .catch(() => {
        if (!controller.signal.aborted) setMovementState({ status: "error" });
      });
    return () => controller.abort();
  }, [
    accessToken,
    locationId,
    movementIngredientId,
    movementPage,
    movementType,
    organizationId,
    reloadVersion,
  ]);

  const balances =
    balanceState.status === "ready" ? balanceState.page.items : [];
  const balanceColumns = useMemo<readonly DataTableColumn<InventoryBalance>[]>(
    () => [
      {
        key: "ingredientName",
        header: "Ingredient",
        cell: (row) => (
          <span>
            <strong>{row.ingredientName}</strong>
            {row.sku === null ? null : (
              <small className="inventory-cell-detail">{row.sku}</small>
            )}
          </span>
        ),
      },
      {
        key: "quantity",
        header: "On hand",
        cell: (row) => `${row.quantity} ${unitLabel(row.baseUnit)}`,
      },
      {
        key: "reorderThreshold",
        header: "Reorder at",
        cell: (row) =>
          row.reorderThreshold === null
            ? "—"
            : `${row.reorderThreshold} ${unitLabel(row.baseUnit)}`,
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => (
          <span
            className={`inventory-status${row.belowReorderThreshold ? " inventory-status--low" : ""}`}
          >
            {row.belowReorderThreshold ? "Low stock" : "In range"}
          </span>
        ),
      },
      {
        key: "updatedAt",
        header: "Last movement",
        cell: (row) =>
          row.updatedAt === null ? "Not started" : formatDate(row.updatedAt),
      },
      {
        key: "actions",
        header: "Actions",
        align: "end",
        cell: (row) =>
          row.ingredientArchived || location === undefined ? (
            "Archived"
          ) : (
            <MovementDialog
              accessToken={accessToken}
              balance={row}
              currencyCode={location.currencyCode}
              locationId={location.id}
              onSaved={() => setReloadVersion((value) => value + 1)}
              organizationId={organizationId}
            />
          ),
      },
    ],
    [accessToken, location, organizationId],
  );

  const movementColumns: readonly DataTableColumn<InventoryMovement>[] = [
    {
      key: "createdAt",
      header: "Recorded",
      cell: (row) => formatDate(row.createdAt),
    },
    { key: "ingredientName", header: "Ingredient" },
    {
      key: "movementType",
      header: "Type",
      cell: (row) => movementLabel(row.movementType),
    },
    {
      key: "quantityDelta",
      header: "Quantity",
      cell: (row) => `${row.quantityDelta} ${unitLabel(row.baseUnit)}`,
    },
    { key: "sourceReference", header: "Reference" },
    {
      key: "totalCostMinor",
      header: "Cost",
      cell: (row) => formatMoney(row.totalCostMinor, row.currencyCode),
    },
    { key: "note", header: "Note" },
  ];

  if (organizationId === "") {
    return (
      <main
        aria-label="Inventory management"
        className="staff-main"
        id="staff-workspace"
      >
        <ProblemState
          title="No inventory scope"
          message="No active organization is available for inventory management."
        />
      </main>
    );
  }

  return (
    <main
      aria-label="Inventory management"
      className="staff-main"
      id="staff-workspace"
    >
      <div className="ingredient-page-heading">
        <div>
          <p className="eyebrow">Location operations</p>
          <h1>Inventory</h1>
          <p className="staff-muted">
            Track live ingredient balances and append auditable stock movements.
          </p>
        </div>
      </div>
      <section aria-label="Inventory scope" className="inventory-scope">
        <Field id="inventory-organization" label="Organization">
          <select
            onChange={(event) => {
              const nextOrganizationId = event.target.value;
              const nextMembership = staffContext.memberships.find(
                (item) => item.organizationId === nextOrganizationId,
              );
              setOrganizationId(nextOrganizationId);
              setLocationId(nextMembership?.locations[0]?.id ?? "");
              setBalancePage(0);
              setMovementPage(0);
              setMovementIngredientId(undefined);
              setBalanceState({ status: "loading" });
              setMovementState({ status: "loading" });
            }}
            value={organizationId}
          >
            {staffContext.memberships.map((item) => (
              <option key={item.organizationId} value={item.organizationId}>
                {item.organizationName}
              </option>
            ))}
          </select>
        </Field>
        <Field id="inventory-location" label="Location">
          <select
            disabled={membership?.locations.length === 0}
            onChange={(event) => {
              setLocationId(event.target.value);
              setBalancePage(0);
              setMovementPage(0);
              setMovementIngredientId(undefined);
              setBalanceState({ status: "loading" });
              setMovementState({ status: "loading" });
            }}
            value={locationId}
          >
            {membership?.locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        {location === undefined ? null : (
          <p className="inventory-location-meta">
            {location.currencyCode} · {location.timezone}
          </p>
        )}
      </section>

      {location === undefined ? (
        <ProblemState
          title="No assigned location"
          message="Your staff membership does not include an active location for inventory management."
        />
      ) : (
        <div className="inventory-workspace">
          <section
            aria-labelledby="inventory-balances-title"
            className="inventory-panel"
          >
            <div className="inventory-panel-heading">
              <div>
                <p className="card-kicker">Current position</p>
                <h2 id="inventory-balances-title">Stock balances</h2>
              </div>
            </div>
            <div className="inventory-filters inventory-filters--balances">
              <form
                className="ingredient-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  setQuery(queryInput.trim() || undefined);
                  setBalancePage(0);
                  setReloadVersion((value) => value + 1);
                }}
              >
                <Field id="inventory-query" label="Search ingredients">
                  <input
                    maxLength={160}
                    onChange={(event) => setQueryInput(event.target.value)}
                    placeholder="Name or SKU"
                    type="search"
                    value={queryInput}
                  />
                </Field>
                <Button size="compact" type="submit" variant="secondary">
                  Search
                </Button>
              </form>
              <label className="ingredient-archive-filter">
                <input
                  checked={includeArchived}
                  onChange={(event) => {
                    setIncludeArchived(event.target.checked);
                    setBalancePage(0);
                  }}
                  type="checkbox"
                />
                Include archived
              </label>
            </div>
            {balanceState.status === "loading" ? (
              <p role="status">Loading stock balances…</p>
            ) : null}
            {balanceState.status === "error" ? (
              <ProblemState
                title="Balances unavailable"
                message="We couldn’t load stock balances for this location."
                onRetry={() => setReloadVersion((value) => value + 1)}
              />
            ) : null}
            {balanceState.status === "ready" ? (
              <div className="ingredient-results">
                <DataTable
                  caption={`${balanceState.page.totalItems} ingredient balance${balanceState.page.totalItems === 1 ? "" : "s"}`}
                  columns={balanceColumns}
                  emptyMessage="No ingredients match these filters."
                  getRowKey={(row) => row.ingredientId}
                  rows={balanceState.page.items}
                />
                <Pagination
                  currentPage={balanceState.page.page + 1}
                  label="Inventory balance pages"
                  onPageChange={(next) => setBalancePage(next - 1)}
                  totalPages={balanceState.page.totalPages}
                />
              </div>
            ) : null}
          </section>

          <section
            aria-labelledby="inventory-history-title"
            className="inventory-panel"
          >
            <div className="inventory-panel-heading">
              <div>
                <p className="card-kicker">Audit trail</p>
                <h2 id="inventory-history-title">Movement history</h2>
              </div>
              <p className="staff-muted">
                Newest movements appear first and cannot be edited.
              </p>
            </div>
            <div className="inventory-filters">
              <Field id="movement-ingredient" label="Ingredient">
                <select
                  onChange={(event) => {
                    setMovementIngredientId(event.target.value || undefined);
                    setMovementPage(0);
                  }}
                  value={movementIngredientId ?? ""}
                >
                  <option value="">All ingredients</option>
                  {balances.map((row) => (
                    <option key={row.ingredientId} value={row.ingredientId}>
                      {row.ingredientName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="movement-type" label="Movement type">
                <select
                  onChange={(event) => {
                    setMovementType(
                      (event.target.value || undefined) as
                        | InventoryMovementType
                        | undefined,
                    );
                    setMovementPage(0);
                  }}
                  value={movementType ?? ""}
                >
                  <option value="">All movement types</option>
                  <option value="OPENING">Opening stock</option>
                  <option value="RECEIPT">Receipt</option>
                  <option value="SALE">Sale</option>
                  <option value="REVERSAL">Reversal</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </Field>
            </div>
            {movementState.status === "loading" ? (
              <p role="status">Loading movement history…</p>
            ) : null}
            {movementState.status === "error" ? (
              <ProblemState
                title="History unavailable"
                message="We couldn’t load movement history for this location."
                onRetry={() => setReloadVersion((value) => value + 1)}
              />
            ) : null}
            {movementState.status === "ready" ? (
              <div className="ingredient-results">
                <DataTable
                  caption={`${movementState.page.totalItems} inventory movement${movementState.page.totalItems === 1 ? "" : "s"}`}
                  columns={movementColumns}
                  emptyMessage="No movements match these filters."
                  getRowKey={(row) => row.id}
                  rows={movementState.page.items}
                />
                <Pagination
                  currentPage={movementState.page.page + 1}
                  label="Inventory movement pages"
                  onPageChange={(next) => setMovementPage(next - 1)}
                  totalPages={movementState.page.totalPages}
                />
              </div>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
