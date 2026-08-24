import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoAccessibilityViolations } from "../../test/accessibility";
import { Button } from "./Button";
import { DataTable } from "./DataTable";
import { Dialog } from "./Dialog";
import { Field } from "./Field";
import { Pagination } from "./Pagination";
import { ProblemState } from "./ProblemState";

describe("interface primitives", () => {
  it("connects field labels, help, and errors to the input", () => {
    render(
      <Field
        description="Use the name shown on the menu."
        error="A product name is required."
        id="product-name"
        label="Product name"
      >
        <input id="product-name" name="name" />
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Product name" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Use the name shown on the menu. A product name is required.",
    );
  });

  it("exposes loading button state without losing its accessible name", () => {
    render(<Button isLoading loadingLabel="Saving product">Save product</Button>);

    const button = screen.getByRole("button", { name: "Saving product" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("renders semantic table structure and an empty state", () => {
    render(
      <DataTable
        caption="Ingredients"
        columns={[{ key: "name", header: "Name" }, { key: "stock", header: "Stock" }]}
        emptyMessage="No ingredients yet."
        getRowKey={(row) => row.name}
        rows={[] as { name: string; stock: string }[]}
      />,
    );

    expect(screen.getByRole("table", { name: "Ingredients" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByText("No ingredients yet.")).toHaveAttribute("colspan", "2");
  });

  it("labels cells for the responsive stacked presentation", () => {
    render(
      <DataTable
        caption="Ingredients"
        columns={[{ key: "name", header: "Ingredient" }, { key: "stock", header: "Stock" }]}
        emptyMessage="No ingredients yet."
        getRowKey={(row) => row.name}
        rows={[{ name: "Assam tea", stock: "4,000 g" }]}
      />,
    );

    expect(screen.getByRole("cell", { name: "Assam tea" })).toHaveAttribute("data-label", "Ingredient");
    expect(screen.getByRole("cell", { name: "4,000 g" })).toHaveAttribute("data-label", "Stock");
  });

  it("renders an expanded row directly after its parent row", () => {
    render(
      <DataTable
        caption="Orders"
        columns={[{ key: "name", header: "Name" }, { key: "total", header: "Total" }]}
        emptyMessage="No orders yet."
        expandedRowKey="tea"
        getRowKey={(row) => row.id}
        renderExpandedRow={(row) => (
          <section aria-label={`${row.name} details`}>Order details</section>
        )}
        rows={[
          { id: "tea", name: "Milk tea", total: "$6.60" },
          { id: "coffee", name: "Coffee", total: "$5.00" },
        ]}
      />,
    );

    const details = screen.getByRole("region", { name: "Milk tea details" });
    const expandedRow = details.closest("tr");
    expect(expandedRow?.previousElementSibling).toHaveTextContent("Milk tea");
    expect(details.closest("td")).toHaveAttribute("colspan", "2");
    expect(screen.queryByRole("region", { name: "Coffee details" })).not.toBeInTheDocument();
  });

  it("opens a labelled modal dialog and returns control to its trigger", async () => {
    const { container } = render(
      <Dialog
        description="This cannot be undone."
        title="Archive ingredient?"
        trigger={<Button>Archive</Button>}
      >
        <Button>Confirm archive</Button>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "Archive" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Archive ingredient?" })).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    await expectNoAccessibilityViolations(container);
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("announces the current page and disables unavailable navigation", () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} onPageChange={onPageChange} totalPages={3} />);

    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("renders a safe problem state with a retry action", () => {
    const onRetry = vi.fn();
    render(
      <ProblemState
        message="Try again before continuing."
        onRetry={onRetry}
        title="Catalog unavailable"
      />,
    );

    expect(screen.getByRole("alert")).toHaveAccessibleName("Catalog unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
