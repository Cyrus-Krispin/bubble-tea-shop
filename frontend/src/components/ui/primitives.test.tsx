import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

  it("opens a labelled modal dialog and returns control to its trigger", async () => {
    render(
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
