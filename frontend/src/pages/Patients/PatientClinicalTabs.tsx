import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { can, canAny } from "../../acl/can";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass } from "../../lib/actions";
import type { ClinicalAreaRecord } from "../../services/catalogs";
import {
  createDiagnosis,
  createEvolution,
  createTreatment,
  getClinicalRecordError,
  listDiagnoses,
  listEvolutions,
  listTreatments,
  type DiagnosisRecord,
  type EvolutionRecord,
  type TreatmentRecord,
} from "../../services/clinicalRecords";

const cardClass =
  "rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-6";
const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const selectClass =
  "mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-none outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800";
const selectMenuClass =
  "max-h-72 rounded-xl border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const AREA_NONE = "sin-area";
const TREATMENT_NONE = "sin-tratamiento";

type ClinicalTab = "diagnostico" | "tratamientos" | "evolucion";

const TABS: Array<{
  id: ClinicalTab;
  label: string;
  view: string;
}> = [
  { id: "diagnostico", label: "Diagnóstico", view: "diagnoses.view" },
  { id: "tratamientos", label: "Tratamientos", view: "treatments.view" },
  { id: "evolucion", label: "Evolución clínica", view: "evolution.view" },
];

type PatientClinicalTabsProps = {
  patientId: number;
  areas: ClinicalAreaRecord[];
  clinicalAreaSlug: string;
  clinicalTreatmentSlug: string;
};

export function PatientClinicalTabs({
  patientId,
  areas,
  clinicalAreaSlug,
  clinicalTreatmentSlug,
}: PatientClinicalTabsProps) {
  const { user } = useAuth();
  const visibleTabs = TABS.filter((tab) => can(user, tab.view));
  const [tab, setTab] = useState<ClinicalTab>(visibleTabs[0]?.id ?? "diagnostico");

  useEffect(() => {
    if (!visibleTabs.some((item) => item.id === tab) && visibleTabs[0]) {
      setTab(visibleTabs[0].id);
    }
  }, [tab, visibleTabs]);

  if (visibleTabs.length === 0) {
    return null;
  }

  return (
    <section className={cardClass} translate="no">
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        {visibleTabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(item.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                selected
                  ? "bg-[#2ad4c5] text-white"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "diagnostico" ? <DiagnosisTab patientId={patientId} /> : null}
        {tab === "tratamientos" ? (
          <TreatmentsTab
            patientId={patientId}
            areas={areas}
            clinicalAreaSlug={clinicalAreaSlug}
            clinicalTreatmentSlug={clinicalTreatmentSlug}
          />
        ) : null}
        {tab === "evolucion" ? <EvolutionTab patientId={patientId} /> : null}
      </div>
    </section>
  );
}

function DiagnosisTab({ patientId }: { patientId: number }) {
  const { user } = useAuth();
  const [items, setItems] = useState<DiagnosisRecord[] | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const canCreate = can(user, "diagnoses.create");

  function load() {
    listDiagnoses(patientId)
      .then(setItems)
      .catch(() => {
        setItems([]);
        toast.error("No se pudieron cargar los diagnósticos.");
      });
  }

  useEffect(() => {
    load();
  }, [patientId]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || saving) {
      return;
    }
    setSaving(true);
    createDiagnosis({ patient: patientId, content: trimmed })
      .then((created) => {
        setItems((current) => [created, ...(current ?? [])]);
        setContent("");
        toast.success("Diagnóstico registrado.");
      })
      .catch((error) =>
        toast.error(getClinicalRecordError(error, "No se pudo guardar el diagnóstico.")),
      )
      .finally(() => setSaving(false));
  }

  return (
    <div className="space-y-5">
      {items === null ? (
        <p className="text-sm text-slate-400">Cargando diagnósticos...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no hay diagnósticos en esta ficha.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-400">
                  {item.student_name ?? "Estudiante"} · {formatDateTime(item.created_at)}
                </p>
                <ValidationBadge validated={item.is_validated} name={item.validated_by_name} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                {item.content}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canCreate ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
            Nuevo diagnóstico
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Describe el diagnóstico clínico"
              required
            />
          </label>
          <button type="submit" disabled={saving} className={primaryActionClass}>
            {saving ? "Guardando..." : "Registrar diagnóstico"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function TreatmentsTab({
  patientId,
  areas,
  clinicalAreaSlug,
  clinicalTreatmentSlug,
}: {
  patientId: number;
  areas: ClinicalAreaRecord[];
  clinicalAreaSlug: string;
  clinicalTreatmentSlug: string;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<TreatmentRecord[] | null>(null);
  const defaultAreaId = areas.find((area) => area.slug === clinicalAreaSlug)?.id ?? "";
  const [areaId, setAreaId] = useState<number | "">(defaultAreaId);
  const selectedArea = areas.find((area) => area.id === areaId);
  const defaultTreatmentId =
    selectedArea?.treatments.find((item) => item.slug === clinicalTreatmentSlug)?.id ?? "";
  const [treatmentId, setTreatmentId] = useState<number | "">(defaultTreatmentId);
  const [saving, setSaving] = useState(false);
  const canCreate = can(user, "treatments.create");
  const treatments = selectedArea?.treatments.filter((item) => item.is_active) ?? [];

  function load() {
    listTreatments(patientId)
      .then(setItems)
      .catch(() => {
        setItems([]);
        toast.error("No se pudieron cargar los tratamientos.");
      });
  }

  useEffect(() => {
    load();
  }, [patientId]);

  function handleAreaChange(value: string) {
    const next = value === AREA_NONE ? "" : Number(value);
    setAreaId(Number.isNaN(next) ? "" : next);
    setTreatmentId("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (areaId === "" || treatmentId === "" || saving) {
      return;
    }
    setSaving(true);
    createTreatment({
      patient: patientId,
      clinical_area: areaId,
      clinical_treatment: treatmentId,
    })
      .then((created) => {
        setItems((current) => [created, ...(current ?? [])]);
        toast.success("Tratamiento registrado.");
      })
      .catch(() => toast.error("No se pudo guardar el tratamiento."))
      .finally(() => setSaving(false));
  }

  return (
    <div className="space-y-5">
      {items === null ? (
        <p className="text-sm text-slate-400">Cargando tratamientos...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no hay tratamientos en esta ficha.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800"
            >
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {item.clinical_treatment_name}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {item.clinical_area_name} · {formatDateTime(item.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canCreate ? (
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
            Área
            <Select
              value={areaId === "" ? AREA_NONE : String(areaId)}
              onValueChange={handleAreaChange}
            >
              <SelectTrigger className={selectClass}>
                <SelectValue placeholder="Selecciona un área" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className={selectMenuClass}
              >
                <SelectItem value={AREA_NONE}>Selecciona un área</SelectItem>
                {areas
                  .filter((area) => area.is_active)
                  .map((area) => (
                    <SelectItem key={area.id} value={String(area.id)}>
                      {area.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
            Tratamiento
            <Select
              value={treatmentId === "" ? TREATMENT_NONE : String(treatmentId)}
              onValueChange={(value) =>
                setTreatmentId(value === TREATMENT_NONE ? "" : Number(value))
              }
              disabled={areaId === ""}
            >
              <SelectTrigger className={selectClass}>
                <SelectValue placeholder="Selecciona un tratamiento" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className={selectMenuClass}
              >
                <SelectItem value={TREATMENT_NONE}>Selecciona un tratamiento</SelectItem>
                {treatments.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className={primaryActionClass}>
              {saving ? "Guardando..." : "Registrar tratamiento"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function EvolutionTab({ patientId }: { patientId: number }) {
  const { user } = useAuth();
  const [items, setItems] = useState<EvolutionRecord[] | null>(null);
  const [date, setDate] = useState(todayIsoDate());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const canCreate = can(user, "evolution.create");

  function load() {
    listEvolutions(patientId)
      .then(setItems)
      .catch(() => {
        setItems([]);
        toast.error("No se pudieron cargar las notas de evolución.");
      });
  }

  useEffect(() => {
    load();
  }, [patientId]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed || saving) {
      return;
    }
    setSaving(true);
    createEvolution({
      patient: patientId,
      date,
      note: trimmed,
    })
      .then((created) => {
        setItems((current) => [created, ...(current ?? [])]);
        setNote("");
        toast.success("Nota de evolución registrada.");
      })
      .catch((error) =>
        toast.error(getClinicalRecordError(error, "No se pudo guardar la evolución.")),
      )
      .finally(() => setSaving(false));
  }

  return (
    <div className="space-y-5">
      {items === null ? (
        <p className="text-sm text-slate-400">Cargando evolución clínica...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no hay notas de evolución.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800"
            >
              <p className="text-xs font-medium text-slate-400">
                {formatDate(item.date)} · {item.student_name ?? "Estudiante"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                {item.note}
              </p>
            </li>
          ))}
        </ol>
      )}

      {canCreate ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
            Fecha
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
            Nota
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Evolución del paciente"
              required
            />
          </label>
          <button type="submit" disabled={saving} className={primaryActionClass}>
            {saving ? "Guardando..." : "Registrar evolución"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function ValidationBadge({
  validated,
  name,
}: {
  validated: boolean;
  name: string | null;
}) {
  if (validated) {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        Validado{name ? ` · ${name}` : ""}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
      Pendiente de validación
    </span>
  );
}

function formatDateTime(value: string): string {
  return format(new Date(value), "d MMM yyyy", { locale: es });
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }
  return format(new Date(year, month - 1, day), "d MMM yyyy", { locale: es });
}

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function hasClinicalTabs(
  user: { permissions: readonly string[] } | null | undefined,
): boolean {
  return canAny(user, ["diagnoses.view", "treatments.view", "evolution.view"]);
}
