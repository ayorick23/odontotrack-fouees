import { ClipboardCheck, Clock3, UserCheck, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  getDashboardSeries,
  getDashboardSummary,
  type DashboardSeries,
  type DashboardSummary,
  type SummaryPeriod,
} from "../../services/dashboard";
import { DashboardCharts } from "./DashboardCharts";

type PeriodFilter = SummaryPeriod | "todos";

const PERIOD_FILTERS: Array<{ value: PeriodFilter; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "1a", label: "1A" },
];

const LOAD_ERROR =
  "No se pudieron cargar los indicadores. Inicia sesión e intenta de nuevo.";

export function Dashboard() {
  const [period, setPeriod] = useState<PeriodFilter>("1a");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [series, setSeries] = useState<DashboardSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = period === "todos" ? {} : { period };
    Promise.all([getDashboardSummary(params), getDashboardSeries(params)])
      .then(([nextSummary, nextSeries]) => {
        if (!cancelled) {
          setSummary(nextSummary);
          setSeries(nextSeries);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(LOAD_ERROR);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period, reloadToken]);

  function changePeriod(next: PeriodFilter) {
    setLoading(true);
    setPeriod(next);
  }

  function retry() {
    setLoading(true);
    setError(null);
    setReloadToken((token) => token + 1);
  }

  if (summary === null) {
    return (
      <div className="space-y-6" translate="no">
        {error ? <LoadError message={error} onRetry={retry} /> : <DashboardSkeleton />}
      </div>
    );
  }

  return (
    <div className="space-y-6" translate="no">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Pacientes registrados en el período
        </p>
        <PeriodFilters period={period} onPeriodChange={changePeriod} />
      </div>

      {error ? (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {/* Al cambiar de período se mantiene lo anterior atenuado: sin saltos. */}
      <div
        className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}
        aria-busy={loading}
      >
        {/* Los estados van en la dona; aquí solo lo que no se ve en otro lado. */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Pacientes registrados"
            value={summary.total_patients}
            icon={<Users className="size-5" />}
          />
          <KpiCard
            label="Asignaciones del período"
            value={summary.total_assignments}
            icon={<UserCheck className="size-5" />}
          />
          <KpiCard
            label="Espera promedio"
            hint="registro a asignación"
            value={summary.average_wait_days}
            unit="días"
            icon={<Clock3 className="size-5" />}
          />
          <KpiCard
            label="Diagnósticos por validar"
            hint="Hoy"
            value={summary.pending_validations}
            icon={<ClipboardCheck className="size-5" />}
          />
        </section>
        <DashboardCharts series={series} summary={summary} />
      </div>
    </div>
  );
}

function PeriodFilters({
  period,
  onPeriodChange,
}: {
  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
}) {
  return (
    <div
      className="flex rounded-full bg-slate-100 p-1 dark:bg-slate-800"
      role="group"
      aria-label="Período"
    >
      {PERIOD_FILTERS.map((filter) => {
        const selected = period === filter.value;
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onPeriodChange(filter.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              selected
                ? "bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

function KpiCard({
  label,
  hint,
  value,
  unit,
  icon,
}: {
  label: string;
  hint?: string;
  /** null se muestra como "—" (p. ej. espera sin asignaciones). */
  value: number | null;
  unit?: string;
  icon: ReactNode;
}) {
  return (
    <article className="flex flex-col justify-between rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
          {hint ? (
            <span className="ml-1 font-normal normal-case tracking-normal">· {hint}</span>
          ) : null}
        </p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold text-slate-800 dark:text-slate-100">
        {value === null ? "—" : value.toLocaleString("es-SV", { maximumFractionDigits: 1 })}
        {unit && value !== null ? (
          <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        ) : null}
      </p>
    </article>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
      <p className="text-sm text-red-700 dark:text-red-400" role="alert">
        {message}
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-[#2ad4c5] px-4 py-2 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
        <Link
          to="/login"
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          Ir al login
        </Link>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["registrados", "asignaciones", "espera", "validar"].map((key) => (
          <div
            key={key}
            className="h-32 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900"
          />
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900" />
        <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900" />
        <div className="h-56 animate-pulse rounded-2xl bg-white shadow-sm xl:col-span-2 dark:bg-slate-900" />
      </section>
    </>
  );
}
