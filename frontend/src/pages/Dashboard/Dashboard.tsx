import {
  CalendarClock,
  ClipboardCheck,
  Clock3,
  FolderOpen,
  GraduationCap,
  Inbox,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  getDashboardOverview,
  getDashboardSeries,
  type DashboardAppointmentRow,
  type DashboardIndicator,
  type DashboardOverview,
  type DashboardSeries,
} from "../../services/dashboard";
import { DashboardCharts, type PeriodFilter } from "./DashboardCharts";
import { AreaStatusChart, BankDemandChart } from "./FacultyCharts";

/**
 * Dashboard por rol: cada bloque llega del backend solo si el usuario tiene
 * el permiso que lo habilita (ver backend/dashboard/overview.py). Arriba lo
 * que hay que hacer, con enlace directo; las estadísticas, al final y solo
 * para quien ve la facultad completa.
 */

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; overview: DashboardOverview };

const cardClass =
  "rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10";

const dateTime = new Intl.DateTimeFormat("es-SV", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const timeOnly = new Intl.DateTimeFormat("es-SV", { hour: "2-digit", minute: "2-digit" });

export function Dashboard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [period, setPeriod] = useState<PeriodFilter>("1a");
  const [series, setSeries] = useState<DashboardSeries | null>(null);
  const showFaculty = state.status === "ready" && state.overview.faculty != null;

  function load() {
    setState({ status: "loading" });
    getDashboardOverview()
      .then((overview) => setState({ status: "ready", overview }))
      .catch(() => setState({ status: "error" }));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!showFaculty) {
      return;
    }
    getDashboardSeries({ period })
      .then(setSeries)
      .catch(() => setSeries(null));
  }, [period, showFaculty]);

  if (state.status === "loading") {
    return <DashboardSkeleton />;
  }
  if (state.status === "error") {
    return (
      <div className={cardClass}>
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          No se pudo cargar el dashboard.
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { my_cases, supervision, bank, faculty, accounts } = state.overview;
  const empty = [my_cases, supervision, bank, faculty, accounts].every(
    (block) => block == null,
  );

  return (
    <div className="space-y-8" translate="no">
      {empty ? (
        <div className={cardClass}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tu rol no tiene indicadores en el dashboard. Usa el menú para ir a
            tus módulos.
          </p>
        </div>
      ) : null}

      {my_cases ? (
        <Block title="Mis casos">
          <CardGrid>
            <ActionCard
              label="Casos activos"
              value={my_cases.cases.length}
              to="/patients"
              icon={<FolderOpen className="size-5" />}
            />
            <ActionCard
              label="Citas en los próximos 7 días"
              value={my_cases.upcoming_appointments.length}
              to="/calendar"
              icon={<CalendarClock className="size-5" />}
            />
            <ActionCard
              label="Diagnósticos esperando validación"
              value={my_cases.diagnoses_awaiting_validation}
              hint="Los valida un docente"
              icon={<ClipboardCheck className="size-5" />}
            />
            <ActionCard
              label="Disponibles en el banco"
              value={my_cases.bank_available}
              to="/assignments"
              hint="Pacientes para elegir"
              icon={<Inbox className="size-5" />}
            />
          </CardGrid>
          <div className="grid gap-4 lg:grid-cols-2">
            <ListCard title="Mis casos activos" empty="No tienes casos activos.">
              {my_cases.cases.map((item) => (
                <li key={item.patient_id}>
                  <Link
                    to={`/patients/${item.patient_id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {item.patient_name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {item.next_appointment
                        ? `Próxima cita: ${dateTime.format(new Date(item.next_appointment))}`
                        : "Sin cita agendada"}
                    </span>
                  </Link>
                </li>
              ))}
            </ListCard>
            <AppointmentList
              title="Citas de los próximos 7 días"
              empty="No tienes citas esta semana."
              rows={my_cases.upcoming_appointments}
              format={dateTime}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tratamientos marcados como realizados en tus casos:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {my_cases.done_treatments_in_my_cases}
            </span>
          </p>
        </Block>
      ) : null}

      {supervision ? (
        <Block title="Supervisión">
          <CardGrid>
            <ActionCard
              label="Diagnósticos por validar"
              value={supervision.diagnoses_to_validate}
              to="/supervision"
              highlight
              icon={<ClipboardCheck className="size-5" />}
            />
            <ActionCard
              label="Casos en proceso"
              value={supervision.cases_in_progress}
              to="/patients?case_status=en_proceso"
              icon={<Stethoscope className="size-5" />}
            />
            <ActionCard
              label="Estudiantes con casos activos"
              value={supervision.students_with_active_cases}
              to="/students"
              icon={<GraduationCap className="size-5" />}
            />
          </CardGrid>
          <div className="grid gap-4 sm:grid-cols-3">
            <IndicatorCard
              label="Digitalización"
              hint="Pacientes con expediente digital"
              indicator={supervision.indicators.digitalization}
            />
            <IndicatorCard
              label="Diagnósticos validados"
              hint="Del total de diagnósticos registrados"
              indicator={supervision.indicators.validated_diagnoses}
            />
            <IndicatorCard
              label="Casos con diagnóstico validado"
              hint="Casos en proceso o finalizados"
              indicator={supervision.indicators.cases_with_validated_diagnosis}
            />
          </div>
        </Block>
      ) : null}

      {bank ? (
        <Block title="Banco y agenda">
          <CardGrid>
            <ActionCard
              label="En el banco sin asignar"
              value={bank.unassigned}
              to="/assignments"
              icon={<Inbox className="size-5" />}
            />
            <ActionCard
              label="Citas de hoy"
              value={bank.today_appointments.length}
              to="/calendar"
              icon={<CalendarClock className="size-5" />}
            />
            <ActionCard
              label="Registrados este mes"
              value={bank.registered_this_month}
              to="/patients"
              icon={<UserPlus className="size-5" />}
            />
            <ActionCard
              label="Espera promedio hasta asignación"
              value={bank.average_wait_days}
              unit="días"
              hint="Pacientes de los últimos 6 meses"
              icon={<Clock3 className="size-5" />}
            />
          </CardGrid>
          <AppointmentList
            title="Citas de hoy"
            empty="No hay citas programadas para hoy."
            rows={bank.today_appointments}
            format={timeOnly}
          />
        </Block>
      ) : null}

      {accounts ? (
        <Block title="Cuentas">
          <div className={cardClass}>
            <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {accounts.active_by_role.map((row) => (
                <li key={row.role}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {row.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {row.count}
                  </p>
                </li>
              ))}
              <li>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Desactivadas
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                  {accounts.inactive}
                </p>
              </li>
            </ul>
            <Link
              to="/users"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300"
            >
              <Users className="size-4" aria-hidden="true" />
              Gestionar usuarios
            </Link>
          </div>
        </Block>
      ) : null}

      {faculty ? (
        <Block title="Facultad">
          <div className="grid gap-4 xl:grid-cols-2">
            <AreaStatusChart rows={faculty.by_area} />
            <BankDemandChart rows={faculty.bank_demand} />
          </div>
          <DashboardCharts series={series} period={period} onPeriodChange={setPeriod} />
        </Block>
      ) : null}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4" aria-label={title}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

function ActionCard({
  label,
  value,
  unit,
  hint,
  to,
  icon,
  highlight = false,
}: {
  label: string;
  value: number | null;
  unit?: string;
  hint?: string;
  to?: string;
  icon: ReactNode;
  /** Resalta la tarjeta cuando hay algo pendiente (value > 0). */
  highlight?: boolean;
}) {
  const active = highlight && value != null && value > 0;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            active
              ? "bg-amber-500 text-white"
              : "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {value == null ? "—" : value.toLocaleString("es-SV")}
        {unit && value != null ? (
          <span className="ml-1.5 text-base font-medium text-slate-500">{unit}</span>
        ) : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </>
  );
  const className = `${cardClass} block ${active ? "ring-2 ring-amber-300 dark:ring-amber-700" : ""}`;
  return to ? (
    <Link to={to} className={`${className} transition hover:-translate-y-0.5`}>
      {body}
    </Link>
  ) : (
    <article className={className}>{body}</article>
  );
}

function IndicatorCard({
  label,
  hint,
  indicator,
}: {
  label: string;
  hint: string;
  indicator: DashboardIndicator | null;
}) {
  const percent = indicator?.percent;
  return (
    <article className={cardClass}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {percent == null ? "—" : `${percent.toLocaleString("es-SV")} %`}
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="presentation"
      >
        <div className="h-full rounded-full bg-teal-600" style={{ width: `${percent ?? 0}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {indicator ? `${indicator.count} de ${indicator.total} · ` : ""}
        {hint}
      </p>
    </article>
  );
}

function ListCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <article className={cardClass}>
      <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {children.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="-mx-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {children}
        </ul>
      )}
    </article>
  );
}

function AppointmentList({
  title,
  empty,
  rows,
  format,
}: {
  title: string;
  empty: string;
  rows: DashboardAppointmentRow[];
  format: Intl.DateTimeFormat;
}) {
  return (
    <ListCard title={title} empty={empty}>
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            to={`/patients/${row.patient_id}`}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {row.patient_name}
              </span>
              {row.student_name ? (
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                  con {row.student_name}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
              {format.format(new Date(row.starts_at))}
            </span>
          </Link>
        </li>
      ))}
    </ListCard>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div
            key={key}
            className="h-32 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900" />
    </div>
  );
}
