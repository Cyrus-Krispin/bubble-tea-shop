import { useEffect, useMemo, useState } from "react";
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
import { formatMoney } from "../catalog/formatMoney";
import type { StaffOutletContext } from "./StaffLayout";
import {
  completeStaffOrder,
  getStaffOrder,
  listStaffOrders,
  OrderOperationError,
  type StaffOrderDetail,
  type StaffOrderPage,
  type StaffOrderStatus,
  type StaffOrderSummary,
} from "./orderOperationsClient";

const PAGE_SIZE = 25;

type PageState =
  | { status: "loading" }
  | { status: "ready"; page: StaffOrderPage }
  | { status: "error" };

type DetailState =
  | { status: "idle" | "loading" }
  | { status: "ready"; order: StaffOrderDetail }
  | { status: "error" };

function formatDate(value: string | null) {
  if (value === null) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function unitLabel(unit: string) {
  if (unit === "GRAM") return "g";
  if (unit === "MILLILITER") return "mL";
  if (unit === "EACH") return "each";
  return unit.toLowerCase();
}

function completionMessage(error: unknown) {
  if (error instanceof OrderOperationError) {
    if (error.code === "ORDER_STATE_CONFLICT")
      return "This order or its payment changed. Reload the current order before trying again.";
    if (error.code === "ORDER_NOT_FOUND")
      return "This order is no longer available in the selected location.";
    if (error.code === "STAFF_ACCESS_DENIED")
      return "Your current staff access no longer permits this location.";
  }
  return "We couldn’t complete this order. It remains unchanged; try again.";
}

export default function OrderOperationsPage() {
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const initialMembership = staffContext.memberships[0];
  const [organizationId, setOrganizationId] = useState(
    initialMembership?.organizationId ?? "",
  );
  const [locationId, setLocationId] = useState(
    initialMembership?.locations[0]?.id ?? "",
  );
  const [statusFilter, setStatusFilter] = useState<
    StaffOrderStatus | undefined
  >("PENDING");
  const [pageNumber, setPageNumber] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [detailVersion, setDetailVersion] = useState(0);
  const [detailState, setDetailState] = useState<DetailState>({
    status: "idle",
  });
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string>();
  const [shortages, setShortages] = useState<OrderOperationError["shortages"]>(
    [],
  );

  const membership = staffContext.memberships.find(
    (item) => item.organizationId === organizationId,
  );
  const location = membership?.locations.find((item) => item.id === locationId);

  useEffect(() => {
    if (organizationId === "" || locationId === "") return;
    const controller = new AbortController();
    listStaffOrders(
      accessToken,
      organizationId,
      locationId,
      { page: pageNumber, size: PAGE_SIZE, status: statusFilter },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (pageNumber > 0 && result.totalPages <= pageNumber)
          setPageNumber(Math.max(0, result.totalPages - 1));
        else setPageState({ status: "ready", page: result });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPageState({ status: "error" });
      });
    return () => controller.abort();
  }, [
    accessToken,
    locationId,
    organizationId,
    pageNumber,
    reloadVersion,
    statusFilter,
  ]);

  useEffect(() => {
    if (
      selectedOrderId === undefined ||
      organizationId === "" ||
      locationId === ""
    ) {
      return;
    }
    const controller = new AbortController();
    getStaffOrder(
      accessToken,
      organizationId,
      locationId,
      selectedOrderId,
      controller.signal,
    )
      .then((order) => {
        if (!controller.signal.aborted)
          setDetailState({ status: "ready", order });
      })
      .catch(() => {
        if (!controller.signal.aborted) setDetailState({ status: "error" });
      });
    return () => controller.abort();
  }, [accessToken, detailVersion, locationId, organizationId, selectedOrderId]);

  async function complete() {
    if (detailState.status !== "ready" || completing) return;
    setCompleting(true);
    setCompletionError(undefined);
    setShortages([]);
    try {
      const order = await completeStaffOrder(
        accessToken,
        organizationId,
        locationId,
        detailState.order.id,
      );
      setDetailState({ status: "ready", order });
      setCompletionOpen(false);
      setPageState({ status: "loading" });
      setReloadVersion((value) => value + 1);
    } catch (error) {
      if (
        error instanceof OrderOperationError &&
        error.code === "ORDER_INSUFFICIENT_STOCK"
      ) {
        setShortages(error.shortages);
        setCompletionError(
          "Stock is short. The order is still pending and nothing was deducted.",
        );
      } else setCompletionError(completionMessage(error));
    } finally {
      setCompleting(false);
    }
  }

  const columns = useMemo<readonly DataTableColumn<StaffOrderSummary>[]>(
    () => [
      {
        key: "publicOrderNumber",
        header: "Pickup",
        cell: (order) => <strong>{order.publicOrderNumber}</strong>,
      },
      {
        key: "createdAt",
        header: "Placed",
        cell: (order) => formatDate(order.createdAt),
      },
      {
        key: "itemQuantity",
        header: "Items",
      },
      {
        key: "totalMinor",
        header: "Total",
        cell: (order) => formatMoney(order.totalMinor, order.currencyCode),
      },
      {
        key: "status",
        header: "State",
        cell: (order) => (
          <span
            className={`order-status order-status--${order.status.toLowerCase()}`}
          >
            {order.status === "COMPLETED" ? "Paid · Completed" : order.status}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        align: "end",
        cell: (order) => (
          <Button
            onClick={() => {
              setSelectedOrderId(order.id);
              setDetailState({ status: "loading" });
              setDetailVersion((value) => value + 1);
            }}
            size="compact"
            variant="secondary"
          >
            View {order.publicOrderNumber}
          </Button>
        ),
      },
    ],
    [],
  );

  if (organizationId === "") {
    return (
      <main
        aria-label="Order operations"
        className="staff-main"
        id="staff-workspace"
      >
        <ProblemState
          message="No active organization is available for order operations."
          title="No order scope"
        />
      </main>
    );
  }

  return (
    <main
      aria-label="Order operations"
      className="staff-main"
      id="staff-workspace"
    >
      <div className="ingredient-page-heading">
        <div>
          <p className="eyebrow">Live service</p>
          <h1>Orders</h1>
          <p className="staff-muted">
            Collect cash and complete orders without overselling ingredients.
          </p>
        </div>
      </div>

      <section aria-label="Order scope and filters" className="order-toolbar">
        <Field id="order-organization" label="Organization">
          <select
            onChange={(event) => {
              const nextId = event.target.value;
              const next = staffContext.memberships.find(
                (item) => item.organizationId === nextId,
              );
              setOrganizationId(nextId);
              setLocationId(next?.locations[0]?.id ?? "");
              setPageNumber(0);
              setPageState({ status: "loading" });
              setSelectedOrderId(undefined);
              setDetailState({ status: "idle" });
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
        <Field id="order-location" label="Location">
          <select
            disabled={membership?.locations.length === 0}
            onChange={(event) => {
              setLocationId(event.target.value);
              setPageNumber(0);
              setPageState({ status: "loading" });
              setSelectedOrderId(undefined);
              setDetailState({ status: "idle" });
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
        <Field id="order-status" label="Order status">
          <select
            onChange={(event) => {
              setStatusFilter(
                (event.target.value || undefined) as
                  | StaffOrderStatus
                  | undefined,
              );
              setPageNumber(0);
              setPageState({ status: "loading" });
              setSelectedOrderId(undefined);
              setDetailState({ status: "idle" });
            }}
            value={statusFilter ?? ""}
          >
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="">All statuses</option>
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
          message="Your staff membership does not include an active location for order operations."
          title="No assigned location"
        />
      ) : (
        <div className="order-workspace">
          <section
            aria-labelledby="order-queue-title"
            className="inventory-panel"
          >
            <div className="inventory-panel-heading">
              <div>
                <p className="card-kicker">Service queue</p>
                <h2 id="order-queue-title">Location orders</h2>
              </div>
              <Button
                onClick={() => {
                  setPageState({ status: "loading" });
                  setReloadVersion((value) => value + 1);
                }}
                size="compact"
                variant="secondary"
              >
                Refresh
              </Button>
            </div>
            {pageState.status === "loading" ? (
              <p role="status">Loading orders…</p>
            ) : null}
            {pageState.status === "error" ? (
              <ProblemState
                message="We couldn’t load orders for this location."
                onRetry={() => {
                  setPageState({ status: "loading" });
                  setReloadVersion((value) => value + 1);
                }}
                title="Orders unavailable"
              />
            ) : null}
            {pageState.status === "ready" ? (
              <div className="ingredient-results">
                <DataTable
                  caption={`${pageState.page.totalItems} order${pageState.page.totalItems === 1 ? "" : "s"}`}
                  columns={columns}
                  emptyMessage="No orders match this status."
                  getRowKey={(order) => order.id}
                  rows={pageState.page.items}
                />
                <Pagination
                  currentPage={pageState.page.page + 1}
                  label="Order pages"
                  onPageChange={(next) => {
                    setPageState({ status: "loading" });
                    setPageNumber(next - 1);
                  }}
                  totalPages={pageState.page.totalPages}
                />
              </div>
            ) : null}
          </section>

          {detailState.status === "loading" ? (
            <p role="status">Loading order details…</p>
          ) : null}
          {detailState.status === "error" ? (
            <ProblemState
              message="We couldn’t load this order. Select it again or refresh the queue."
              onRetry={() => {
                setDetailState({ status: "loading" });
                setDetailVersion((value) => value + 1);
              }}
              title="Order unavailable"
            />
          ) : null}
          {detailState.status === "ready" ? (
            <OrderDetail
              completionError={completionError}
              completionOpen={completionOpen}
              completing={completing}
              onComplete={complete}
              onOpenChange={(open) => {
                setCompletionOpen(open);
                if (open) {
                  setCompletionError(undefined);
                  setShortages([]);
                }
              }}
              order={detailState.order}
              shortages={shortages}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}

function OrderDetail({
  completionError,
  completionOpen,
  completing,
  onComplete,
  onOpenChange,
  order,
  shortages,
}: {
  completionError?: string;
  completionOpen: boolean;
  completing: boolean;
  onComplete: () => void;
  onOpenChange: (open: boolean) => void;
  order: StaffOrderDetail;
  shortages: OrderOperationError["shortages"];
}) {
  return (
    <section aria-labelledby="order-detail-title" className="order-detail">
      <div className="order-detail-heading">
        <div>
          <p className="card-kicker">Pickup order</p>
          <h2 id="order-detail-title">{order.publicOrderNumber}</h2>
          <p className="staff-muted">Placed {formatDate(order.createdAt)}</p>
        </div>
        <span
          className={`order-status order-status--${order.status.toLowerCase()}`}
        >
          {order.status === "COMPLETED" ? "Paid · Completed" : order.status}
        </span>
      </div>
      <div className="order-detail-grid">
        <div>
          <h3>Items</h3>
          <ol className="order-line-list">
            {order.lines.map((line) => (
              <li key={line.lineNumber}>
                <div>
                  <strong>
                    {line.quantity} × {line.productName}
                  </strong>
                  <span>{line.variantName}</span>
                </div>
                <strong>
                  {formatMoney(line.lineTotalMinor, order.currencyCode)}
                </strong>
                {line.options.length === 0 ? null : (
                  <p>
                    {line.options
                      .map(
                        (option) => `${option.groupName}: ${option.choiceName}`,
                      )
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3>Stock check</h3>
          <ul className="order-requirement-list">
            {order.requirements.map((requirement) => (
              <li key={requirement.ingredientId}>
                <span>
                  <strong>{requirement.ingredientName}</strong>
                  <small>
                    {requirement.requiredQuantity}{" "}
                    {unitLabel(requirement.baseUnit)} needed
                  </small>
                </span>
                <span
                  className={requirement.sufficient ? "" : "order-stock-short"}
                >
                  {requirement.availableQuantity} available
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="order-total-row">
        <span>Cash total</span>
        <strong>{formatMoney(order.totalMinor, order.currencyCode)}</strong>
      </div>
      {order.status === "PENDING" ? (
        <Dialog
          description={`Confirm that ${formatMoney(order.totalMinor, order.currencyCode)} cash has been received. Completion deducts the current ingredient snapshot.`}
          onOpenChange={onOpenChange}
          open={completionOpen}
          title={`Complete ${order.publicOrderNumber}`}
          trigger={<Button>Collect cash &amp; complete</Button>}
        >
          {completionError === undefined ? null : (
            <p className="form-message form-message--error" role="alert">
              {completionError}
            </p>
          )}
          {shortages.length === 0 ? null : (
            <ul className="order-shortage-list">
              {shortages.map((shortage) => (
                <li key={shortage.ingredientId}>
                  <strong>{shortage.ingredientName}</strong>:{" "}
                  {shortage.requiredQuantity} {unitLabel(shortage.baseUnit)}{" "}
                  required, {shortage.availableQuantity} available
                </li>
              ))}
            </ul>
          )}
          <div className="recipe-form-actions">
            <Button
              isLoading={completing}
              loadingLabel="Completing order"
              onClick={onComplete}
            >
              Confirm cash &amp; complete
            </Button>
          </div>
        </Dialog>
      ) : (
        <p className="order-completed-note">
          Cash recorded {formatDate(order.paidAt)} · Completed{" "}
          {formatDate(order.completedAt)}
        </p>
      )}
    </section>
  );
}
