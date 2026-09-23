import { CircleCheckBig, Clock3, UserCheck, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  countByStatus,
  getDashboardSeries,
  getDashboardSummary,
  type DashboardSeries,
  type DashboardSummary,
} from "../../services/dashboard";
import { DashboardCharts, type PeriodFilter } from "./DashboardCharts";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; summary: DashboardSummary };

export function Dashboard() {
  const [period, setPeriod] = useState<PeriodFilter>("1a");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [series, setSeries] = useState<DashboardSeries | null>(null);

  function loadSummary() {
    setState({ status: "loading" });
    getDashboardSummary()
      .then((summary) => setState({ status: "ready", summary }))
      .catch(() =>
        setState({
          status: "error",
          message:
            "No se pudieron cargar los indicadores. Inicia sesión e intenta de nuevo.",
        }),
      );
  }

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    const params = period === "todos" ? {} : { period };
    getDashboardSeries(params)
      .then(setSeries)
      .catch(() => setSeries(null));
  }, [period]);

  return (
    <div className="space-y-6" translate="no">
      {state.status === "loading" ? <DashboardSkeleton /> : null}

      {state.status === "error" ? (
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">
            {state.message}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={loadSummary}
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
      ) : null}

      {state.status === "ready" ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total de pacientes registrados"
              value={state.summary.total_patients}
              accent="bg-violet-500"
              icon={<Users className="size-5" />}
            />
            <KpiCard
              label="Pacientes pendientes de asignación"
              value={countByStatus(state.summary, "pendiente")}
              accent="bg-emerald-400"
              icon={<Clock3 className="size-5" />}
            />
            <KpiCard
              label="Pacientes asignados"
              value={countByStatus(state.summary, "en_proceso")}
              accent="bg-teal-400"
              icon={<UserCheck className="size-5" />}
            />
            <KpiCard
              label="Pacientes finalizados"
              value={countByStatus(state.summary, "finalizado")}
              accent="bg-amber-400"
              icon={<CircleCheckBig className="size-5" />}
            />
          </section>
          <DashboardCharts
            series={series}
            period={period}
            onPeriodChange={setPeriod}
          />
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <span
          className={`flex size-9 items-center justify-center rounded-full text-white ${accent}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {value.toLocaleString("es-SV")}
      </p>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["registrados", "pendientes", "asignados", "finalizados"].map((key) => (
          <div
            key={key}
            className="h-32 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900"
          />
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900" />
        <div className="h-80 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900" />
      </section>
    </>
  );
}
