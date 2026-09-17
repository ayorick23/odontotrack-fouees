import type { ReactNode } from "react";

interface TableColumn<Row> {
  header: string;
  render: (row: Row) => ReactNode;
  align?: "left" | "right";
}

interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  emptyMessage?: string;
  getRowKey?: (row: Row, index: number) => string | number;
  caption?: string;
}

export function Table<Row>({
  columns,
  rows,
  emptyMessage = "No hay datos para mostrar.",
  getRowKey,
  caption,
}: TableProps<Row>) {
  if (rows.length === 0) {
    return (
      <p className="px-2 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={`whitespace-nowrap px-4 py-3 font-semibold ${
                  column.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getRowKey ? getRowKey(row, index) : index}
              className="border-b border-slate-50 last:border-0 dark:border-slate-800/80"
            >
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={`px-4 py-3.5 text-slate-700 dark:text-slate-200 ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
