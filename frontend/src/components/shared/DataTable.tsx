import { Fragment, type ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export type DataTableColumn<Row> = {
  align?: "end" | "start";
  cell?: (row: Row) => ReactNode;
  header: ReactNode;
  key: string;
};

type DataTableProps<Row> = {
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  emptyMessage: string;
  expandedRowKey?: string;
  getRowKey: (row: Row) => string;
  renderExpandedRow?: (row: Row) => ReactNode;
  rows: readonly Row[];
};

function defaultCell<Row>(row: Row, key: string): ReactNode {
  const value = (row as Record<string, unknown>)[key];
  return value === null || value === undefined ? "—" : String(value);
}

export function DataTable<Row>({
  caption,
  columns,
  emptyMessage,
  expandedRowKey,
  getRowKey,
  renderExpandedRow,
  rows,
}: DataTableProps<Row>) {
  return (
    <div aria-label={`${caption} table`} className="overflow-hidden rounded-lg border bg-card" role="region" tabIndex={0}>
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead className={column.align === "end" ? "text-right" : undefined} key={column.key}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell className="h-24 text-center text-muted-foreground" colSpan={columns.length}>{emptyMessage}</TableCell></TableRow>
          ) : rows.map((row) => {
            const rowKey = getRowKey(row);
            const isExpanded = rowKey === expandedRowKey && renderExpandedRow !== undefined;
            return (
              <Fragment key={rowKey}>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      className={column.align === "end" ? "text-right" : undefined}
                      data-label={typeof column.header === "string" ? column.header : undefined}
                      key={column.key}
                    >
                      <div>
                        {column.cell === undefined ? defaultCell(row, column.key) : column.cell(row)}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
                {isExpanded ? (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={columns.length}>{renderExpandedRow(row)}</TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
