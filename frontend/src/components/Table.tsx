import type { ReactNode } from "react";

import { LIST_CELL, LIST_FIRST_CELL, LIST_HEADER_CELL } from "./listing/styles";

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
  /** Ancho mínimo antes de desplazar en horizontal (por defecto 720 px). */
  minWidth?: string;
}

/**
 * Tabla simple con el estilo de los listados (identidad 2026-11): encabezado
 * en píldora arena y barra de acento a la izquierda al pasar el mouse, igual
 * que el directorio de pacientes.
 */
export function Table<Row>({
  columns,
  rows,
  emptyMessage = "No hay datos para mostrar.",
  getRowKey,
  caption,
  minWidth = "min-w-[720px]",
}: TableProps<Row>) {
  if (rows.length === 0) {
    return (
      <p className="px-2 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      <table className={`w-full ${minWidth} border-separate border-spacing-0 text-left text-sm`}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.header}
                scope="col"
                className={`${LIST_HEADER_CELL} ${index === 0 ? "pl-4" : ""} ${
                  column.align === "right" ? "pr-4 text-right" : "text-left"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey ? getRowKey(row, rowIndex) : rowIndex} className="group">
              {columns.map((column, index) => (
                <td
                  key={column.header}
                  className={`${LIST_CELL} ${index === 0 ? LIST_FIRST_CELL : ""} text-slate-700 dark:text-slate-200 ${
                    column.align === "right" ? "pr-4 text-right" : "text-left"
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
