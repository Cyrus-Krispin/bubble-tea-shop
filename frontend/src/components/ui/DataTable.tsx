import { Fragment, type ReactNode } from "react";

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
    <div aria-label={`${caption} table`} className="ui-table-scroll" role="region" tabIndex={0}>
      <table className="ui-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.align === "end" ? "ui-table__end" : undefined} key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="ui-table__empty" colSpan={columns.length}>{emptyMessage}</td></tr>
          ) : rows.map((row) => {
            const rowKey = getRowKey(row);
            const isExpanded = rowKey === expandedRowKey && renderExpandedRow !== undefined;
            return (
              <Fragment key={rowKey}>
                <tr>
                  {columns.map((column) => (
                    <td
                      className={column.align === "end" ? "ui-table__end" : undefined}
                      data-label={typeof column.header === "string" ? column.header : undefined}
                      key={column.key}
                    >
                      <div className="ui-table__value">
                        {column.cell === undefined ? defaultCell(row, column.key) : column.cell(row)}
                      </div>
                    </td>
                  ))}
                </tr>
                {isExpanded ? (
                  <tr className="ui-table__expanded-row">
                    <td colSpan={columns.length}>{renderExpandedRow(row)}</td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
