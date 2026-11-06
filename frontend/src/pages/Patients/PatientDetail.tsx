import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Pencil } from "../../components/icons";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { can } from "../../acl/can";
import { GLASS_PANEL, SOLID_BLOCK } from "../../components/listing/styles";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { FinalizeCaseButton } from "./FinalizeCaseButton";
import { ReleasePatientButton } from "./ReleasePatientButton";
import { PatientClinicalTabs, hasClinicalTabs } from "./PatientClinicalTabs";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { primaryActionClass } from "../../lib/actions";
import { ageLabel } from "../../lib/age";
import { phoneHref } from "../../lib/phones";
import {
  areaLabel,
  listClinicalAreas,
  treatmentLabel,
  type ClinicalAreaRecord,
} from "../../services/catalogs";
import {
  EMERGENCY_RELATIONSHIP_LABELS,
  getPatient,
  patientDocumentLabel,
  patientFullName,
  patientInitials,
  type Patient,
} from "../../services/patients";

const PatientOdontogramSection = lazy(() =>
  import("./PatientOdontogramSection").then((mod) => ({
    default: mod.PatientOdontogramSection,
  })),
);

/** Bloque sólido dentro del marco de vidrio (doble fondo). */
const cardClass = SOLID_BLOCK;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; patient: Patient; areas: ClinicalAreaRecord[] };

export function PatientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const patientId = Number(id);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!Number.isInteger(patientId) || patientId < 1) {
      setState({ status: "error", message: "Paciente no válido." });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([getPatient(patientId), listClinicalAreas()])
      .then(([patient, areas]) => {
        if (!cancelled) {
          setState({ status: "ready", patient, areas });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudo cargar la ficha de este paciente.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (state.status === "loading") {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500">
        Cargando ficha del paciente...
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.message}
        </p>
        <Link
          to="/patients"
          className="text-sm font-medium text-lime-ink hover:text-lime-ink"
        >
          ← Volver al directorio
        </Link>
      </div>
    );
  }

  const { patient, areas } = state;
  const assignedLocked =
    user?.role === "recepcion" && patient.has_active_assignment;
  // El estudiante edita y evalúa (diagnóstico, odontograma) los pacientes
  // disponibles y sus casos activos: justo cuando can_evaluate es true.
  const studentLocked = user?.role === "estudiante" && !patient.can_evaluate;
  const canEdit = can(user, "patients.edit") && !assignedLocked && !studentLocked;
  const canFinalize = can(user, "assignments.change_status");
  const canRelease = can(user, "assignments.release");
  // Docente y admin pueden corregir el odontograma aun con el caso cerrado.
  const odontogramLocked = studentLocked;
  const areaName = patient.clinical_area
    ? areaLabel(areas, patient.clinical_area)
    : null;
  const treatmentName = patient.clinical_subcategory
    ? treatmentLabel(areas, patient.clinical_subcategory)
    : null;
  const age = ageLabel(patient.date_of_birth);
  const relationship = patient.emergency_contact_relationship
    ? EMERGENCY_RELATIONSHIP_LABELS[patient.emergency_contact_relationship]
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/patients"
          className="text-sm font-medium text-lime-ink hover:text-lime-ink"
        >
          ← Volver al directorio
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canFinalize && patient.active_assignment_id !== null ? (
            <FinalizeCaseButton
              assignmentId={patient.active_assignment_id}
              patientName={patientFullName(patient)}
              onFinalized={() =>
                setState({
                  status: "ready",
                  areas,
                  patient: {
                    ...patient,
                    case_status: "finalizado",
                    has_active_assignment: false,
                    active_assignment_id: null,
                    can_write_clinical: false,
                  },
                })
              }
            />
          ) : null}
          {canRelease && patient.active_assignment_id !== null ? (
            <ReleasePatientButton
              assignmentId={patient.active_assignment_id}
              patientName={patientFullName(patient)}
              isOwnCase={user?.role === "estudiante"}
              onReleased={() =>
                setState({
                  status: "ready",
                  areas,
                  patient: {
                    ...patient,
                    case_status: "pendiente",
                    has_active_assignment: false,
                    active_assignment_id: null,
                    assigned_to: null,
                    assignment_note: "",
                    can_write_clinical: false,
                    can_evaluate: user?.role === "estudiante",
                  },
                })
              }
            />
          ) : null}
          {canEdit ? (
            <Link
              to={`/patients/${patient.id}/edit`}
              className={primaryActionClass}
            >
              <Pencil className="size-4" />
              Editar ficha
            </Link>
          ) : null}
        </div>
      </div>

      {assignedLocked ? (
        <p
          className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          Este paciente ya está asignado. Recepción no puede editar la ficha;
          el seguimiento lo llevan estudiante y docente.
        </p>
      ) : null}

      {/* Doble fondo: identidad arriba y, debajo, contacto y emergencia
          lado a lado, todo dentro del mismo marco de vidrio. */}
      <div className={`${GLASS_PANEL} grid gap-2 lg:grid-cols-2`}>
        <section className={`${cardClass} lg:col-span-2`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {patient.photo ? (
              <img
                src={patient.photo}
                alt={`Foto de ${patientFullName(patient)}`}
                className="size-20 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                className="flex size-20 shrink-0 items-center justify-center rounded-full bg-lime-soft text-xl font-semibold text-lime-ink"
                aria-hidden="true"
              >
                {patientInitials(patient)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-[26px] leading-tight font-bold tracking-[-0.03em] text-ink dark:text-white">
                  {patientFullName(patient)}
                </h1>
                <CaseStatusBadge status={patient.case_status} />
              </div>
              {/* Datos de identificación en una sola línea. */}
              <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {patientDocumentLabel(patient)}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {patient.date_of_birth ? (
                    <>
                      {formatBirthDate(patient.date_of_birth)}
                      {age ? ` (${age})` : null}
                    </>
                  ) : (
                    "Sin fecha de nacimiento"
                  )}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Registrado el{" "}
                  {format(new Date(patient.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  {patient.created_by_name ? ` por ${patient.created_by_name}` : null}
                </span>
              </p>
            </div>
          </div>

          {/* Seguimiento del caso: una fila de cuatro datos. */}
          <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-ink/5 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10">
            <Fact label="Estudiante">{patient.assigned_to ?? emptyValue("Sin asignar")}</Fact>
            <Fact label="Primer diagnóstico">
              {patient.first_diagnosis_by ?? emptyValue("Sin diagnóstico")}
            </Fact>
            <Fact label="Área clínica">{areaName ?? emptyValue("Sin área")}</Fact>
            <Fact label="Tratamiento">{treatmentName ?? emptyValue("Sin tratamiento")}</Fact>
            {patient.assignment_note ? (
              <Fact label="Nota de asignación" className="sm:col-span-2 lg:col-span-4">
                {patient.assignment_note}
              </Fact>
            ) : null}
          </dl>
        </section>

        <section className={cardClass}>
          <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-ink dark:text-white">
            Contacto
          </h2>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact label="Teléfono">
              <PhoneLink value={patient.phone_number} />
            </Fact>
            <Fact label="WhatsApp">
              <PhoneLink value={patient.whatsapp_number} />
            </Fact>
            <Fact label="Correo">
              {patient.email.trim() ? (
                <a href={`mailto:${patient.email}`} className="break-all text-lime-ink hover:underline">
                  {patient.email}
                </a>
              ) : (
                emptyValue()
              )}
            </Fact>
            <Fact label="Dirección">{patient.address.trim() || emptyValue()}</Fact>
          </dl>
        </section>

        <section className={cardClass}>
          <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-ink dark:text-white">
            Contacto de emergencia
          </h2>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact label="Nombre">{patient.emergency_contact_name.trim() || emptyValue()}</Fact>
            <Fact label="Parentesco">{relationship ?? emptyValue("Sin parentesco")}</Fact>
            <Fact label="Teléfono">
              <PhoneLink value={patient.emergency_contact_phone} />
            </Fact>
          </dl>
        </section>
      </div>

      {hasClinicalTabs(user) ? (
        <PatientClinicalTabs
          patientId={patient.id}
          areas={areas}
          clinicalAreaSlug={patient.clinical_area}
          clinicalTreatmentSlug={patient.clinical_subcategory}
          canWriteClinical={patient.can_write_clinical}
          canEvaluate={patient.can_evaluate}
        />
      ) : null}

      {can(user, "odontogram.view") ? (
        <Suspense
          fallback={
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Cargando odontograma...
            </p>
          }
        >
          <PatientOdontogramSection
            patientId={patient.id}
            patientName={patientFullName(patient)}
            readOnly={!can(user, "odontogram.update") || odontogramLocked}
            darkMode={theme === "dark"}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm leading-6 font-medium wrap-break-word text-slate-800 dark:text-slate-100">
        {children}
      </dd>
    </div>
  );
}

function PhoneLink({ value }: { value: string }) {
  const trimmed = value.trim();
  if (!trimmed) {
    return emptyValue();
  }
  return (
    <a
      href={phoneHref(trimmed)}
      className="text-lime-ink hover:underline"
    >
      {trimmed}
    </a>
  );
}

function emptyValue(label = "Sin registrar") {
  return (
    <span className="font-normal text-slate-300 dark:text-slate-600">
      {label}
    </span>
  );
}


function formatBirthDate(value: string | null): ReactNode {
  if (!value) {
    return emptyValue();
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return emptyValue();
  }
  return format(new Date(year, month - 1, day), "d 'de' MMMM 'de' yyyy", {
    locale: es,
  });
}

