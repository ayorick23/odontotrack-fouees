import { useParams } from "react-router-dom";

// Detalle de un paciente. Pendiente: consumir GET /api/patients/:id/
// y mostrar sus registros clínicos y asignaciones relacionadas.
export function PatientDetail() {
  const { id } = useParams();

  return (
    <div>
      <h1>Paciente #{id}</h1>
    </div>
  );
}
