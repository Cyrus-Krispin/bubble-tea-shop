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
import { CatalogSectionNav } from "./CatalogSectionNav";
import type { StaffOutletContext } from "./StaffLayout";
import {
  createMenuProduct,
  getMenuProducts,
  MenuError,
  type MenuProductPage,
  type MenuProductSummary,
} from "./menuClient";

const PAGE_SIZE = 25;
const KEBAB_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type ListState =
  | { status: "loading" }
  | { status: "ready"; page: MenuProductPage }
  | { status: "error" };

function menuMessage(error: unknown) {
  if (error instanceof MenuError) {
    if (error.code === "MENU_CONFLICT")
      return "That product name or public slug is already in use.";
    if (error.code === "MENU_INVALID")
      return "Check the product details and try again.";
  }
  return "We couldn’t save this product. Try again.";
}

function CreateProductDialog({
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
  const [publicSlug, setPublicSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = publicSlug.trim();
    if (
      name.trim() === "" ||
      !KEBAB_PATTERN.test(slug) ||
      !/^\d+$/.test(displayOrder)
    ) {
      setError(
        "Enter a name, a lowercase kebab-case slug, and a non-negative display order.",
      );
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await createMenuProduct(accessToken, organizationId, {
        name: name.trim(),
        publicSlug: slug,
        description: description.trim() || null,
        category: category.trim() || null,
        imageUrl: null,
        artworkKey: null,
        displayOrder: Number(displayOrder),
      });
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(menuMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description="Create the customer-facing product, then add variants, recipes, prices, and options."
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName("");
          setPublicSlug("");
          setDescription("");
          setCategory("");
          setDisplayOrder("0");
          setError(undefined);
        }
      }}
      open={open}
      title="Add menu product"
      trigger={<Button size="compact">Add product</Button>}
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
        <Field
          id={`${prefix}-slug`}
          label="Public slug"
          description="Lowercase words separated by hyphens."
        >
          <input
            maxLength={160}
            onChange={(event) => setPublicSlug(event.target.value)}
            placeholder="classic-milk-tea"
            required
            value={publicSlug}
          />
        </Field>
        <Field id={`${prefix}-category`} label="Category">
          <input
            maxLength={120}
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          />
        </Field>
        <Field id={`${prefix}-description`} label="Description">
          <textarea
            maxLength={4000}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            value={description}
          />
        </Field>
        <Field id={`${prefix}-order`} label="Display order">
          <input
            inputMode="numeric"
            min="0"
            onChange={(event) => setDisplayOrder(event.target.value)}
            type="number"
            value={displayOrder}
          />
        </Field>
        {error === undefined ? null : (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        <div className="recipe-form-actions">
          <Button
            isLoading={saving}
            loadingLabel="Creating product"
            type="submit"
          >
            Create product
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function MenuManagementPage() {
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
    getMenuProducts(
      accessToken,
      organizationId,
      { includeArchived, page, query, size: PAGE_SIZE },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (page > 0 && result.totalPages <= page)
          setPage(Math.max(0, result.totalPages - 1));
        else setState({ status: "ready", page: result });
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

  const columns: readonly DataTableColumn<MenuProductSummary>[] = [
    { key: "name", header: "Product" },
    { key: "publicSlug", header: "Public slug" },
    { key: "category", header: "Category", cell: (row) => row.category ?? "—" },
    { key: "activeVariantCount", header: "Variants" },
    {
      key: "archived",
      header: "Status",
      cell: (row) => (row.archived ? "Archived" : "Active"),
    },
    {
      key: "actions",
      header: "Actions",
      align: "end",
      cell: (row) => (
        <Link
          className="ui-button ui-button--secondary ui-button--compact"
          to={`/staff/catalog/menu/${row.id}?organizationId=${encodeURIComponent(organizationId)}`}
        >
          Manage
        </Link>
      ),
    },
  ];

  if (organizationId === "")
    return (
      <main
        aria-label="Menu management"
        className="staff-main"
        id="staff-workspace"
      >
        <ProblemState
          title="No catalog scope"
          message="No active organization is available for menu management."
        />
      </main>
    );

  return (
    <main
      aria-label="Menu management"
      className="staff-main"
      id="staff-workspace"
    >
      <CatalogSectionNav />
      <div className="ingredient-page-heading">
        <div>
          <p className="eyebrow">Catalog management</p>
          <h1>Menu</h1>
          <p className="staff-muted">
            Build products, variants, location prices, and availability.
          </p>
        </div>
        <CreateProductDialog
          accessToken={accessToken}
          onSaved={() => setReloadVersion((value) => value + 1)}
          organizationId={organizationId}
        />
      </div>
      <section aria-label="Menu filters" className="ingredient-toolbar">
        <Field id="menu-organization" label="Organization">
          <select
            onChange={(event) => {
              setOrganizationId(event.target.value);
              setPage(0);
            }}
            value={organizationId}
          >
            {staffContext.memberships.map((membership) => (
              <option
                key={membership.organizationId}
                value={membership.organizationId}
              >
                {membership.organizationName}
              </option>
            ))}
          </select>
        </Field>
        <form
          className="ingredient-search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(queryInput.trim() || undefined);
            setPage(0);
            setReloadVersion((value) => value + 1);
          }}
        >
          <Field id="menu-query" label="Search">
            <input
              maxLength={160}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Product name or slug"
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
              setPage(0);
            }}
            type="checkbox"
          />
          Include archived
        </label>
      </section>
      {state.status === "loading" ? (
        <p role="status">Loading menu products…</p>
      ) : null}
      {state.status === "error" ? (
        <ProblemState
          title="Menu unavailable"
          message="We couldn’t load menu products for this organization."
          onRetry={() => setReloadVersion((value) => value + 1)}
        />
      ) : null}
      {state.status === "ready" ? (
        <div className="ingredient-results">
          <DataTable
            caption={`${state.page.totalItems} product${state.page.totalItems === 1 ? "" : "s"}`}
            columns={columns}
            emptyMessage="No products match these filters."
            getRowKey={(row) => row.id}
            rows={state.page.items}
          />
          <Pagination
            currentPage={state.page.page + 1}
            label="Menu product pages"
            onPageChange={(next) => setPage(next - 1)}
            totalPages={state.page.totalPages}
          />
        </div>
      ) : null}
    </main>
  );
}
