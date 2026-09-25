import { SearchCombobox } from "../../components/SearchCombobox";
import {
  listAssignableStudents,
  type AssignableStudent,
} from "../../services/assignments";

type StudentComboboxProps = {
  value: AssignableStudent | null;
  onChange: (student: AssignableStudent | null) => void;
};

export function StudentCombobox({ value, onChange }: StudentComboboxProps) {
  return (
    <SearchCombobox
      label="Estudiante"
      placeholder="Buscar estudiante por nombre"
      listLabel="Estudiantes"
      value={value}
      onChange={onChange}
      search={listAssignableStudents}
      getLabel={(student) => student.name}
      getHint={(student) => activeCasesLabel(student.active_cases)}
      emptyMessage="Ningún estudiante coincide."
      errorMessage="No se pudieron cargar los estudiantes."
    />
  );
}

function activeCasesLabel(count: number): string {
  if (count === 0) {
    return "Sin casos activos";
  }
  return count === 1 ? "1 caso activo" : `${count} casos activos`;
}
