import { useParams } from "react-router-dom";

export function PatientForm() {
  const { id } = useParams();

  return (
    <div>
      <h1>{id ? "Editar paciente" : "Nuevo paciente"}</h1>
    </div>
  );
}
