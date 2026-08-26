import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import {
  DataTable,
  Pagination,
  ProblemState,
  SelectField,
  type DataTableColumn,
} from "../../components/shared";
import { Button } from "../../components/ui/button";
import type { StaffOutletContext } from "./StaffLayout";
import {
  listAuditEvents,
  type AuditCategory,
  type AuditEvent,
  type AuditPage as AuditPageResult,
} from "./auditClient";

const PAGE_SIZE = 50;

type PageState =
  | { status: "loading" }
  | { status: "ready"; page: AuditPageResult }
  | { status: "error" };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AuditPage() {
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const [organizationId, setOrganizationId] = useState(
    staffContext.memberships[0]?.organizationId ?? "",
  );
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory>();
  const [pageNumber, setPageNumber] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    if (organizationId === "") return;
    const controller = new AbortController();
    listAuditEvents(
      accessToken,
      organizationId,
      { category: categoryFilter, page: pageNumber, size: PAGE_SIZE },
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
  }, [accessToken, categoryFilter, organizationId, pageNumber, reloadVersion]);

  const columns = useMemo<readonly DataTableColumn<AuditEvent>[]>(() => [
    {
      key: "occurredAt",
      header: "Time",
      cell: (item) => <time dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time>,
    },
    {
      key: "category",
      header: "Category",
      cell: (item) => (
        <span className={`audit-category audit-category--${item.category.toLowerCase()}`}>
          {humanize(item.category)}
        </span>
      ),
    },
    { key: "action", header: "Action", cell: (item) => humanize(item.action) },
    {
      key: "entityLabel",
      header: "Record",
      cell: (item) => (
        <><strong>{item.entityLabel}</strong><small className="inventory-cell-detail">{humanize(item.entityType)}</small></>
      ),
    },
    {
      key: "locationName",
      header: "Location",
      cell: (item) => item.locationName ?? "Organization-wide",
    },
    {
      key: "actorLabel",
      header: "Actor",
      cell: (item) => item.actorLabel ?? "System / guest",
    },
    { key: "detail", header: "Detail", cell: (item) => item.detail ?? "—" },
  ], []);

  if (organizationId === "") {
    return (
      <main aria-label="Audit timeline" className="staff-main" id="staff-workspace">
        <ProblemState message="No active organization is available for audit history." title="No audit scope" />
      </main>
    );
  }

  return (
    <main aria-label="Audit timeline" className="staff-main" id="staff-workspace">
      <div className="ingredient-page-heading">
        <div>
          <p className="eyebrow">Accountability</p>
          <h1>Audit timeline</h1>
          <p className="staff-muted">Review durable catalog, inventory, and order activity in one place.</p>
        </div>
      </div>

      <section aria-label="Audit scope and filters" className="audit-toolbar">
        <SelectField
          id="audit-organization"
          label="Organization"
          onValueChange={(nextOrganizationId) => {
            setOrganizationId(nextOrganizationId);
            setPageNumber(0);
            setPageState({ status: "loading" });
          }}
          options={staffContext.memberships.map((membership) => ({
            label: membership.organizationName,
            value: membership.organizationId,
          }))}
          value={organizationId}
        />
        <SelectField
          emptyLabel="All activity"
          id="audit-category"
          label="Category"
          onValueChange={(nextCategory) => {
            setCategoryFilter((nextCategory || undefined) as AuditCategory | undefined);
            setPageNumber(0);
            setPageState({ status: "loading" });
          }}
          options={[
            { label: "Catalog", value: "CATALOG" },
            { label: "Inventory", value: "INVENTORY" },
            { label: "Orders", value: "ORDER" },
            { label: "Staff access", value: "STAFF" },
          ]}
          value={categoryFilter ?? ""}
        />
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
      </section>

      <section aria-labelledby="audit-events-title" className="inventory-panel">
        <div className="inventory-panel-heading">
          <div>
            <p className="card-kicker">Newest first</p>
            <h2 id="audit-events-title">Operational events</h2>
          </div>
        </div>
        {pageState.status === "loading" ? <p role="status">Loading audit events…</p> : null}
        {pageState.status === "error" ? (
          <ProblemState
            message="We couldn’t load audit history for this organization."
            onRetry={() => {
              setPageState({ status: "loading" });
              setReloadVersion((value) => value + 1);
            }}
            title="Audit history unavailable"
          />
        ) : null}
        {pageState.status === "ready" ? (
          <div className="ingredient-results">
            <DataTable
              caption={`${pageState.page.totalItems} audit event${pageState.page.totalItems === 1 ? "" : "s"}`}
              columns={columns}
              emptyMessage="No audit events match this category."
              getRowKey={(item) => `${item.category}-${item.id}`}
              rows={pageState.page.items}
            />
            <Pagination
              currentPage={pageState.page.page + 1}
              label="Audit event pages"
              onPageChange={(nextPage) => {
                setPageState({ status: "loading" });
                setPageNumber(nextPage - 1);
              }}
              totalPages={pageState.page.totalPages}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
