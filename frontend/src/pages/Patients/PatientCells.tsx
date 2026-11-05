import {
  areaLabel,
  treatmentLabel,
  type ClinicalAreaRecord,
} from "../../services/catalogs";
import {
  patientDocumentLabel,
  patientFullName,
  patientInitials,
  type PatientListItem,
} from "../../services/patients";

/** Foto o iniciales + nombre, y debajo "#id · documento · teléfono". */
export function PatientIdentity({ patient }: { patient: PatientListItem }) {
  const document =
    patient.document_type === "dui" && patient.dui
      ? `DUI ${patient.dui}`
      : patientDocumentLabel(patient);
  const secondary = [`#${patient.id}`, document, patient.phone_number]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-3">
      {patient.photo ? (
        <img src={patient.photo} alt="" className="size-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
          {patientInitials(patient)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-800 group-hover:text-teal-800 dark:text-slate-100 dark:group-hover:text-teal-200">
          {patientFullName(patient)}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{secondary}</p>
      </div>
    </div>
  );
}

/** Área de la ficha y, debajo, el tratamiento (subcategoría) si lo hay. */
export function PatientArea({
  patient,
  areas,
}: {
  patient: PatientListItem;
  areas: ClinicalAreaRecord[];
}) {
  if (!patient.clinical_area) {
    return <span className="text-xs text-slate-400">Sin área</span>;
  }
  return (
    <>
      <p className="text-slate-700 dark:text-slate-200">{areaLabel(areas, patient.clinical_area)}</p>
      {patient.clinical_subcategory ? (
        <p className="max-w-[11rem] truncate text-xs text-slate-500 dark:text-slate-400">
          {treatmentLabel(areas, patient.clinical_subcategory)}
        </p>
      ) : null}
    </>
  );
}
