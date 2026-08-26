import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataTable } from "./DataTable";
import { Pagination } from "./Pagination";

type IngredientRow = { id: string; name: string; stock: string; status: string };

const rows: readonly IngredientRow[] = [
  { id: "assam", name: "Assam Tea", stock: "4,000 g", status: "Low stock" },
  { id: "pearls", name: "Tapioca Pearls", stock: "9,250 g", status: "Ready" },
];

const meta = {
  component: DataTable<IngredientRow>,
  parameters: {
    docs: {
      description: {
        component: "Semantic, horizontally scrollable operational data with a required caption and deterministic row keys.",
      },
    },
  },
  title: "Design System/Data display",
} satisfies Meta<typeof DataTable<IngredientRow>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PopulatedTable: Story = {
  args: {
    caption: "Ingredient balances",
    columns: [
      { key: "name", header: "Ingredient" },
      { align: "end", key: "stock", header: "Stock" },
      { key: "status", header: "Status" },
    ],
    emptyMessage: "No ingredients yet.",
    getRowKey: (row) => row.id,
    rows,
  },
};

export const EmptyTable: Story = {
  args: { ...PopulatedTable.args, rows: [] },
};

function PaginationPreview() {
  const [page, setPage] = useState(4);
  return <Pagination currentPage={page} onPageChange={setPage} totalPages={12} />;
}

export const PaginatedResults: Story = {
  args: PopulatedTable.args,
  render: () => <PaginationPreview />,
};
