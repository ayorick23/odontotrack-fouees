import type { ReactNode } from "react";

// Tabla genérica reutilizable. La idea es usarla para listar pacientes,
// asignaciones, estudiantes, etc. sin repetir el markup de <table> en
// cada pantalla. Todavía sin estilos ni ordenamiento/paginación.
interface TableColumn<Row> {
  header: string;
  render: (row: Row) => ReactNode;
}

interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  emptyMessage?: string;
}

export function Table<Row>({
  columns,
  rows,
  emptyMessage = "No hay datos para mostrar.",
}: TableProps<Row>) {
  if (rows.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.header}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td key={column.header}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
