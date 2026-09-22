import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CircleCheckBig,
  Clock3,
  Pencil,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { can } from "../../acl/can";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass } from "../../lib/actions";
import {
  areaLabel,
  listClinicalAreas,
  treatmentLabel,
  type ClinicalAreaRecord,
} from "../../services/catalogs";
import {
  CASE_STATUS_LABELS,
  EMERGENCY_RELATIONSHIP_LABELS,
  getPatient,
  patientFullName,
  patientInitials,
  type CaseStatus,
  type Patient,
} from "../../services/patients";

const cardClass =
  "rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-6";

const STATUS_ICONS: Record<CaseStatus, LucideIcon> = {
  pendiente: Clock3,
  en_proceso: UserCheck,
  finalizado: CircleCheckBig,
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; patient: Patient; areas: ClinicalAreaRecord[] };

export function PatientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
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
          className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
        >
          ← Volver al directorio
        </Link>
      </div>
    );
  }

  const { patient, areas } = state;
  const assignedLocked =
    user?.role === "recepcion" && patient.has_active_assignment;
  const canEdit = can(user, "patients.edit") && !assignedLocked;
  const areaName = patient.clinical_area
    ? areaLabel(areas, patient.clinical_area)
    : null;
  const treatmentName = patient.clinical_subcategory
    ? treatmentLabel(areas, patient.clinical_subcategory)
    : null;
  const age = patientAge(patient.date_of_birth);
  const relationship = patient.emergency_contact_relationship
    ? EMERGENCY_RELATIONSHIP_LABELS[patient.emergency_contact_relationship]
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/patients"
          className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
        >
          ← Volver al directorio
        </Link>
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

      {assignedLocked ? (
        <p
          className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          Este paciente ya está asignado. Recepción no puede editar la ficha;
          el seguimiento lo llevan estudiante y docente.
        </p>
      ) : null}

      <section className={cardClass}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {patient.photo ? (
            <img
              src={patient.photo}
              alt={`Foto de ${patientFullName(patient)}`}
              className="size-28 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex size-28 shrink-0 items-center justify-center rounded-full bg-teal-50 text-2xl font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
              aria-hidden="true"
            >
              {patientInitials(patient)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                {patientFullName(patient)}
              </h1>
              <StatusBadge status={patient.case_status} />
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Fact label="DUI">{patient.dui}</Fact>
              <Fact label="Nacimiento">
                {patient.date_of_birth ? (
                  <>
                    {formatBirthDate(patient.date_of_birth)}
                    {age ? (
                      <span className="font-normal text-slate-500">
                        {" "}
                        · {age}
                      </span>
                    ) : null}
                  </>
                ) : (
                  emptyValue()
                )}
              </Fact>
              <Fact label="Área">{areaName ?? emptyValue("Sin área")}</Fact>
              <Fact label="Tratamiento">
                {treatmentName ?? emptyValue("Sin tratamiento")}
              </Fact>
              <Fact label="Estudiante">
                {patient.assigned_to ?? emptyValue("Sin asignar")}
              </Fact>
              <Fact label="Registrado">
                {format(new Date(patient.created_at), "d 'de' MMMM 'de' yyyy", {
                  locale: es,
                })}
              </Fact>
            </dl>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
            Contacto
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Teléfono">
              <PhoneLink value={patient.phone_number} />
            </Fact>
            <Fact label="WhatsApp">
              <PhoneLink value={patient.whatsapp_number} />
            </Fact>
            <Fact label="Correo">
              {patient.email.trim() ? (
                <a
                  href={`mailto:${patient.email}`}
                  className="text-teal-700 hover:underline dark:text-teal-400"
                >
                  {patient.email}
                </a>
              ) : (
                emptyValue()
              )}
            </Fact>
            <Fact label="Dirección" className="sm:col-span-2">
              {patient.address.trim() || emptyValue()}
            </Fact>
          </dl>
        </section>

        <section className={cardClass}>
          <h2 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
            Contacto de emergencia
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Nombre">
              {patient.emergency_contact_name.trim() || emptyValue()}
            </Fact>
            <Fact label="Teléfono">
              <PhoneLink value={patient.emergency_contact_phone} />
            </Fact>
            <Fact label="Parentesco">
              {relationship ?? emptyValue("Sin parentesco")}
            </Fact>
          </dl>
        </section>
      </div>
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
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-6 font-medium wrap-break-word text-slate-800 dark:text-slate-100">
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
      href={`tel:${trimmed}`}
      className="text-teal-700 hover:underline dark:text-teal-400"
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

function StatusBadge({ status }: { status: CaseStatus }) {
  const Icon = STATUS_ICONS[status];
  const styles: Record<CaseStatus, string> = {
    pendiente:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    en_proceso: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    finalizado: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {CASE_STATUS_LABELS[status]}
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

function patientAge(dateOfBirth: string | null): string | null {
  if (!dateOfBirth) {
    return null;
  }
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1;
  }
  if (age < 0) {
    return null;
  }
  return age === 1 ? "1 año" : `${age} años`;
}
