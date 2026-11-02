import {
  BadgeCheck,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  ClipboardCheck,
  Clock3,
  FolderOpen,
  GraduationCap,
  Headset,
  Inbox,
  Search,
  Shield,
  Stethoscope,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { can } from "../../acl/can";
import { useAuth } from "../../hooks/useAuth";
import {
  getDashboardOverview,
  getDashboardSeries,
  type DashboardOverview,
  type DashboardSeries,
  type SeriesPeriod,
} from "../../services/dashboard";
import { SINGLE_SERIES_COLOR, useChartTheme } from "./chartColors";
import {
  AgendaToday,
  AreaStatusBars,
  CARD,
  Card,
  CardLink,
  KpiCard,
  LineChart,
  MonthBars,
  OccupancyHeatmap,
  Pill,
  ProgressBar,
  QuickActions,
  RankBars,
  StatusDonut,
  TipLayer,
  type KpiSpec,
} from "./widgets";

/**
 * Dashboard por rol (maqueta aprobada el 2026-11-01). El layout lo decide
 * qué bloques manda el backend, y eso depende de los permisos ACL (ver
 * backend/dashboard/overview.py):
 *   my_cases → estudiante · faculty → admin · supervision → docente ·
 *   bank → recepción · accounts → soporte.
 * Cabe sin scroll en una pantalla 16:9; en ventanas más bajas hace scroll
 * en lugar de aplastar las gráficas.
 */

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; overview: DashboardOverview };

type Perms = { permissions: string[] };
type Action = { to: string; label: string; icon: ReactNode };

const ICON = "size-4";
const ACTION_ICON = "size-5";
const dateTime = new Intl.DateTimeFormat("es-SV", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const timeOnly = new Intl.DateTimeFormat("es-SV", { hour: "2-digit", minute: "2-digit" });
const joinedDate = new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short", year: "numeric" });

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Buenos días";
  }
  return hour < 19 ? "Buenas tardes" : "Buenas noches";
}

function since(iso: string): string {
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) {
    return "hace un momento";
  }
  if (hours < 24) {
    return `hace ${hours} h`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

/** Solo los accesos para los que el usuario tiene permiso. */
function allowed(user: Perms, items: Array<[string, Action]>): Action[] {
  return items.filter(([permission]) => can(user, permission)).map(([, action]) => action);
}

export function Dashboard() {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  function load() {
    setState({ status: "loading" });
    getDashboardOverview()
      .then((overview) => setState({ status: "ready", overview }))
      .catch(() => setState({ status: "error" }));
  }

  useEffect(() => {
    load();
  }, []);

  if (state.status === "loading") {
    return <DashboardSkeleton />;
  }
  if (state.status === "error") {
    return (
      <div className={`${CARD} p-6`}>
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          No se pudo cargar el dashboard.
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const name = user?.first_name || user?.username || "";
  const layout = pickLayout(state.overview, { permissions: user?.permissions ?? [] });

  return (
    <TipLayer>
      <div
        className="grid h-full min-h-[44rem] grid-rows-[auto_auto_minmax(0,1.1fr)_minmax(0,1fr)] gap-4"
        translate="no"
      >
        <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {greeting()}
          {name ? `, ${name}` : ""}
        </p>
        {layout ?? (
          <div className={`${CARD} row-span-3 p-6`}>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Tu rol no tiene indicadores en el dashboard. Usa el menú para ir a tus módulos.
            </p>
          </div>
        )}
      </div>
    </TipLayer>
  );
}

function pickLayout(overview: DashboardOverview, user: Perms): ReactNode {
  if (overview.my_cases) {
    return <StudentLayout data={overview.my_cases} />;
  }
  if (overview.faculty && overview.supervision && overview.bank) {
    return (
      <AdminLayout supervision={overview.supervision} bank={overview.bank} faculty={overview.faculty} />
    );
  }
  if (overview.supervision) {
    return <TeacherLayout data={overview.supervision} />;
  }
  if (overview.bank) {
    return <ReceptionLayout data={overview.bank} user={user} />;
  }
  if (overview.accounts) {
    return <SupportLayout data={overview.accounts} user={user} />;
  }
  return null;
}

function Kpis({ items }: { items: KpiSpec[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-3">{children}</div>;
}

// --- Estudiante -------------------------------------------------------------

type StudentData = NonNullable<DashboardOverview["my_cases"]>;

function StudentLayout({ data }: { data: StudentData }) {
  return (
    <>
      <Kpis
        items={[
          { label: "Casos activos", metric: data.kpis.active_cases, icon: <FolderOpen className={ICON} />, featured: true },
          { label: "Citas esta semana", metric: data.kpis.week_appointments, icon: <CalendarDays className={ICON} /> },
          { label: "Diagnósticos por validar", metric: data.kpis.pending_diagnoses, icon: <ClipboardCheck className={ICON} />, lowerIsBetter: true },
          { label: "Tratamientos realizados", metric: data.kpis.done_treatments, icon: <BadgeCheck className={ICON} /> },
        ]}
      />
      <Row>
        <Card title="Mis casos" className="lg:col-span-2" action={<CardLink to="/patients">Ver todos</CardLink>}>
          {data.cases.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No tienes casos activos.{" "}
              <Link to="/assignments" className="font-semibold text-teal-700 dark:text-teal-300">
                Elige uno del banco
              </Link>
              .
            </p>
          ) : (
            <ul className="h-full divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {data.cases.map((item) => (
                <li key={item.patient_id}>
                  <Link
                    to={`/patients/${item.patient_id}`}
                    className="flex items-center gap-3 rounded-lg py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <Initials name={item.patient_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {item.patient_name}
                      </p>
                      <p
                        className={`text-[11px] ${
                          item.next_appointment ? "text-slate-500" : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {item.next_appointment
                          ? dateTime.format(new Date(item.next_appointment))
                          : "Sin cita agendada"}
                      </p>
                    </div>
                    <div className="w-28 shrink-0">
                      <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                        <span>Plan</span>
                        <span>
                          {item.plan_done}/{item.plan_total}
                        </span>
                      </div>
                      <ProgressBar
                        value={item.plan_total ? (item.plan_done / item.plan_total) * 100 : 0}
                        label={`Plan: ${item.plan_done} de ${item.plan_total} tratamientos realizados`}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <TasksCard tasks={data.tasks} />
      </Row>
      <Row>
        <Card
          title="Tratamientos que realizaste por mes"
          className="lg:col-span-2"
          action={<Pill>Últimos 12 meses</Pill>}
        >
          <MonthBars rows={data.done_by_month} unit="tratamientos" />
        </Card>
        <Card title="Disponibles en el banco" action={<CardLink to="/assignments">Elegir</CardLink>}>
          <p className="text-[28px] font-semibold leading-none text-slate-900 dark:text-white">
            {data.bank_available}
            <span className="ml-1 text-xs font-medium text-slate-400">pacientes</span>
          </p>
          <p className="mb-3 mt-1 text-[11px] text-slate-500">Lo más planificado para practicar:</p>
          <RankBars
            rows={data.bank_top.map((row) => ({ name: row.name, value: row.count, hint: row.area }))}
            empty="Nada planificado en el banco."
          />
        </Card>
      </Row>
    </>
  );
}

function TasksCard({ tasks }: { tasks: StudentData["tasks"] }) {
  return (
    <section
      className="flex min-h-0 flex-col rounded-2xl bg-slate-900 p-4 text-white dark:bg-slate-800"
      aria-label="Tus pendientes"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Tus pendientes</h2>
        {tasks.length ? (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
            {tasks.length}
          </span>
        ) : null}
      </div>
      {tasks.length === 0 ? (
        <p className="flex flex-1 items-center gap-2 text-sm text-slate-300">
          <Check className="size-4 text-teal-400" /> Estás al día.
        </p>
      ) : (
        <ul className="space-y-2.5 overflow-y-auto text-sm">
          {tasks.map((task, index) => (
            <li key={`${task.kind}-${task.patient_id}-${index}`}>
              <Link to={`/patients/${task.patient_id}`} className="flex items-start gap-2.5 hover:text-teal-200">
                <span className="mt-0.5 size-4 shrink-0 rounded-full border border-slate-500" />
                <div>
                  <p>{task.title}</p>
                  <p className="text-[11px] text-slate-400">
                    {task.detail}
                    {task.starts_at ? ` · ${timeOnly.format(new Date(task.starts_at))}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --- Docente ----------------------------------------------------------------

type SupervisionData = NonNullable<DashboardOverview["supervision"]>;

function teacherKpis(data: SupervisionData): KpiSpec[] {
  return [
    { label: "Diagnósticos por validar", metric: data.kpis.pending_diagnoses, icon: <ClipboardCheck className={ICON} />, lowerIsBetter: true, featured: true },
    { label: "Casos en proceso", metric: data.kpis.cases_in_progress, icon: <Stethoscope className={ICON} /> },
    { label: "Estudiantes con casos", metric: data.kpis.students_active, icon: <GraduationCap className={ICON} /> },
    { label: "Diagnósticos validados", metric: data.kpis.validated_ratio, icon: <BadgeCheck className={ICON} /> },
  ];
}

function TeacherLayout({ data }: { data: SupervisionData }) {
  return (
    <>
      <Kpis items={teacherKpis(data)} />
      <Row>
        <ValidationQueue data={data} />
        <Indicators data={data} />
      </Row>
      <Row>
        <Card title="Diagnósticos validados por mes" action={<Pill>12 meses</Pill>}>
          <MonthBars rows={data.validated_by_month} unit="validados" />
        </Card>
        <Card title="Estudiantes con más casos activos">
          <RankBars
            rows={data.top_students.map((row) => ({ name: row.name, value: row.count }))}
            empty="Sin casos activos."
          />
        </Card>
        <Card title="Estado de los casos">
          <StatusDonut counts={data.status} />
        </Card>
      </Row>
    </>
  );
}

function ValidationQueue({ data }: { data: SupervisionData }) {
  return (
    <Card
      title="Cola de validación"
      className="lg:col-span-2"
      action={<CardLink to="/supervision">Ir a Supervisión</CardLink>}
    >
      {data.queue.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
          <Check className="size-4 text-teal-600" /> No hay diagnósticos por validar.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.queue.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{row.content}</p>
                <p className="text-[11px] text-slate-500">
                  {row.patient_name} · por {row.student_name}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">{since(row.created_at)}</span>
              <Link
                to="/supervision"
                className="shrink-0 rounded-full bg-teal-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-teal-800"
              >
                Revisar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Indicators({ data }: { data: SupervisionData }) {
  const rows = [
    { label: "Digitalización", hint: "Pacientes con expediente digital", indicator: data.indicators.digitalization },
    { label: "Diagnósticos validados", hint: "Del total registrado", indicator: data.indicators.validated_diagnoses },
    { label: "Casos con diagnóstico validado", hint: "En proceso o finalizados", indicator: data.indicators.cases_with_validated_diagnosis },
  ];
  return (
    <Card title="Indicadores">
      <div className="flex h-full flex-col justify-around gap-3">
        {rows.map(({ label, hint, indicator }) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">{label}</span>
              <b className="text-slate-800 dark:text-slate-100">
                {indicator?.percent == null ? "—" : `${indicator.percent}%`}
              </b>
            </div>
            <ProgressBar
              value={indicator?.percent ?? 0}
              label={indicator ? `${hint}: ${indicator.count} de ${indicator.total}` : hint}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

// --- Recepción --------------------------------------------------------------

type BankData = NonNullable<DashboardOverview["bank"]>;

function receptionKpis(data: BankData): KpiSpec[] {
  return [
    { label: "En el banco sin asignar", metric: data.kpis.unassigned, icon: <Inbox className={ICON} />, lowerIsBetter: true, featured: true },
    { label: "Citas de hoy", metric: data.kpis.today_appointments, icon: <CalendarClock className={ICON} /> },
    { label: "Registrados este mes", metric: data.kpis.registered_month, icon: <UserPlus className={ICON} /> },
    { label: "Espera hasta asignación", metric: data.kpis.wait_days, icon: <Clock3 className={ICON} />, lowerIsBetter: true },
  ];
}

function ReceptionLayout({ data, user }: { data: BankData; user: Perms }) {
  const actions = allowed(user, [
    ["patients.create", { to: "/patients/new", label: "Registrar paciente", icon: <UserPlus className={ACTION_ICON} /> }],
    ["calendar.create", { to: "/calendar", label: "Agendar cita", icon: <CalendarPlus className={ACTION_ICON} /> }],
    ["assignments.assign_student", { to: "/assignments", label: "Asignar estudiante", icon: <UserCheck className={ACTION_ICON} /> }],
    ["patients.view", { to: "/patients", label: "Buscar paciente", icon: <Search className={ACTION_ICON} /> }],
  ]);
  return (
    <>
      <Kpis items={receptionKpis(data)} />
      <Row>
        <Card title="Agenda de hoy" className="lg:col-span-2" action={<CardLink to="/calendar">Calendario</CardLink>}>
          <AgendaToday rows={data.today} />
        </Card>
        <Card title="Accesos rápidos">
          <QuickActions actions={actions} />
        </Card>
      </Row>
      <Row>
        <Card
          title="Ocupación de la clínica (citas por franja)"
          className="lg:col-span-2"
          action={<Pill>{data.occupancy.label}</Pill>}
        >
          <OccupancyHeatmap data={data.occupancy} />
        </Card>
        <Card title="Pacientes registrados por mes" action={<Pill>12 meses</Pill>}>
          <MonthBars rows={data.registered_by_month} unit="registrados" />
        </Card>
      </Row>
    </>
  );
}

// --- Admin ------------------------------------------------------------------

const PERIODS: Array<{ value: SeriesPeriod; label: string }> = [
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "1a", label: "1A" },
  { value: "todos", label: "Todos" },
];

function AdminLayout({
  supervision,
  bank,
  faculty,
}: {
  supervision: SupervisionData;
  bank: BankData;
  faculty: NonNullable<DashboardOverview["faculty"]>;
}) {
  const { status } = useChartTheme();
  const [period, setPeriod] = useState<SeriesPeriod>("1a");
  const [series, setSeries] = useState<DashboardSeries | null>(null);
  // Segunda serie: el violeta validado junto al teal (ver chartColors.ts).
  const violet = status.pendiente;

  useEffect(() => {
    getDashboardSeries({ period })
      .then(setSeries)
      .catch(() => setSeries(null));
  }, [period]);

  const [pending, inProgress] = teacherKpis(supervision);
  const [unassigned, , , wait] = receptionKpis(bank);
  return (
    <>
      <Kpis items={[pending, { ...unassigned, label: "En el banco", featured: false }, inProgress, wait]} />
      <Row>
        <Card
          title="Registrados y asignaciones por mes"
          className="lg:col-span-2"
          action={
            <div className="flex gap-1" role="group" aria-label="Período">
              {PERIODS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={period === item.value}
                  onClick={() => setPeriod(item.value)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    period === item.value
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              {series ? (
                <LineChart
                  labels={series.months.map((month) => month.label.split(" ")[0])}
                  series={[
                    { name: "Registrados", color: SINGLE_SERIES_COLOR, values: series.months.map((month) => month.patients) },
                    { name: "Asignaciones", color: violet, values: series.months.map((month) => month.assignments) },
                  ]}
                />
              ) : (
                <div className="h-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              )}
            </div>
            <div className="flex gap-4 pt-1">
              {[
                ["Registrados", SINGLE_SERIES_COLOR],
                ["Asignaciones", violet],
              ].map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="size-2 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Estado de los casos">
          <StatusDonut counts={faculty.status} />
        </Card>
      </Row>
      <Row>
        <Card title="Tratamientos más demandados en el banco" action={<CardLink to="/assignments">Ver banco</CardLink>}>
          <RankBars
            rows={faculty.bank_demand.slice(0, 4).map((row) => ({ name: row.name, value: row.count, hint: row.area }))}
            empty="Ningún paciente del banco tiene tratamientos planificados."
          />
        </Card>
        <Card title="Pacientes por área clínica">
          <AreaStatusBars rows={faculty.by_area} />
        </Card>
        <Card title="Ocupación de la clínica" action={<Pill>{faculty.occupancy.label}</Pill>}>
          <OccupancyHeatmap data={faculty.occupancy} />
        </Card>
      </Row>
    </>
  );
}

// --- Soporte ----------------------------------------------------------------

function SupportLayout({ data, user }: { data: NonNullable<DashboardOverview["accounts"]>; user: Perms }) {
  const actions = allowed(user, [
    ["users.view", { to: "/users", label: "Usuarios", icon: <UserCog className={ACTION_ICON} /> }],
    ["roles.view", { to: "/roles", label: "Roles y permisos", icon: <Shield className={ACTION_ICON} /> }],
    ["catalogs.view", { to: "/catalogs", label: "Catálogos", icon: <BookOpen className={ACTION_ICON} /> }],
    ["support.view", { to: "/support", label: "Soporte", icon: <Headset className={ACTION_ICON} /> }],
  ]);
  return (
    <>
      <Kpis
        items={[
          { label: "Cuentas activas", metric: data.kpis.active, icon: <Users className={ICON} />, featured: true },
          { label: "Cuentas nuevas este mes", metric: data.kpis.new_month, icon: <UserPlus className={ICON} /> },
          { label: "Cuentas desactivadas", metric: data.kpis.inactive, icon: <UserX className={ICON} /> },
          { label: "Roles configurados", metric: data.kpis.roles, icon: <Shield className={ICON} /> },
        ]}
      />
      <Row>
        <Card
          title="Cuentas creadas recientemente"
          className="lg:col-span-2"
          action={<CardLink to="/users">Ver todas</CardLink>}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.recent.map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-2">
                <Initials name={row.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{row.name}</p>
                  <p className="text-[11px] text-slate-500">{row.role_label}</p>
                </div>
                <span className="text-[11px] text-slate-400">{joinedDate.format(new Date(row.date_joined))}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Cuentas activas por rol">
          <RankBars rows={data.active_by_role.map((row) => ({ name: row.label, value: row.count }))} empty="Sin cuentas." />
        </Card>
      </Row>
      <Row>
        <Card title="Cuentas nuevas por mes" className="lg:col-span-2" action={<Pill>12 meses</Pill>}>
          <MonthBars rows={data.new_by_month} unit="cuentas" />
        </Card>
        <Card title="Accesos rápidos">
          <QuickActions actions={actions} />
        </Card>
      </Row>
    </>
  );
}

// --- Piezas -------------------------------------------------------------------

function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {letters}
    </span>
  );
}

function DashboardSkeleton() {
  const block = "animate-pulse rounded-2xl bg-white dark:bg-slate-900";
  return (
    <div className="grid h-full min-h-[44rem] grid-rows-[auto_auto_minmax(0,1.1fr)_minmax(0,1fr)] gap-4">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className={`${block} h-28`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className={`${block} col-span-2`} />
        <div className={block} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className={`${block} col-span-2`} />
        <div className={block} />
      </div>
    </div>
  );
}
