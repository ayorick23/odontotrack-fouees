import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../context/ThemeContext";
import type { DashboardMetric, DashboardOverview } from "../../services/dashboard";
import { Dashboard } from "./Dashboard";

const mocks = vi.hoisted(() => ({
  getDashboardOverview: vi.fn(),
  getDashboardSeries: vi.fn(),
  permissions: [] as string[],
}));

vi.mock("../../services/dashboard", async () => {
  const actual = await vi.importActual<typeof import("../../services/dashboard")>(
    "../../services/dashboard",
  );
  return {
    ...actual,
    getDashboardOverview: mocks.getDashboardOverview,
    getDashboardSeries: mocks.getDashboardSeries,
  };
});

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { first_name: "Lucía", username: "luciazd", permissions: mocks.permissions },
  }),
}));

const metric = (value: number, trend: number | null = 10): DashboardMetric => ({
  value,
  trend,
  trend_label: "vs mes anterior",
  spark: [1, 2, 3, 2, 3, value],
});

const months = Array.from({ length: 12 }, (_, index) => ({
  month: `2026-${String(index + 1).padStart(2, "0")}`,
  label: ["Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov"][index],
  count: index,
}));

const occupancy = {
  label: "Esta semana",
  days: ["Lun", "Mar", "Mié", "Jue", "Vie"],
  slots: ["7–9", "9–11", "11–13", "13–15", "15–17"],
  cells: Array.from({ length: 5 }, () => [0, 1, 2, 0, 1]),
};

const NONE: DashboardOverview = {
  my_cases: null,
  supervision: null,
  bank: null,
  faculty: null,
  accounts: null,
};

const STUDENT: DashboardOverview = {
  ...NONE,
  my_cases: {
    kpis: {
      active_cases: metric(2),
      week_appointments: metric(1),
      pending_diagnoses: metric(1, -50),
      done_treatments: metric(3),
    },
    cases: [
      { patient_id: 7, patient_name: "Ana Pronto", next_appointment: "2026-11-03T15:00:00Z", plan_done: 1, plan_total: 3 },
      { patient_id: 8, patient_name: "Beto Sincita", next_appointment: null, plan_done: 0, plan_total: 0 },
    ],
    tasks: [
      { kind: "schedule", title: "Agendar cita para Beto Sincita", detail: "Caso sin cita", patient_id: 8 },
    ],
    upcoming_appointments: [],
    done_by_month: months,
    bank_available: 21,
    bank_top: [{ treatment: "endo", name: "Endodoncia monorradicular", area: "Endodoncia", count: 6 }],
  },
};

const SUPERVISION: NonNullable<DashboardOverview["supervision"]> = {
  kpis: {
    pending_diagnoses: metric(4, 40),
    cases_in_progress: metric(17),
    students_active: metric(9),
    validated_ratio: { ...metric(82), unit: "%" },
  },
  queue: [
    {
      id: 1,
      content: "Pulpitis irreversible en 36",
      patient_id: 7,
      patient_name: "Carlos Mejía",
      student_name: "Lucía Zepeda",
      created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
  ],
  diagnoses_to_validate: 4,
  indicators: {
    digitalization: { percent: 91, count: 10, total: 11 },
    validated_diagnoses: { percent: 82, count: 9, total: 11 },
    cases_with_validated_diagnosis: null,
  },
  validated_by_month: months,
  top_students: [{ name: "Lucía Zepeda", count: 4 }],
  status: { pendiente: 21, en_proceso: 17, finalizado: 8 },
};

const BANK: NonNullable<DashboardOverview["bank"]> = {
  kpis: {
    unassigned: metric(21, -8),
    today_appointments: metric(6),
    registered_month: metric(12),
    wait_days: { ...metric(7.9, -12), unit: "días" },
  },
  today: [],
  occupancy,
  registered_by_month: months,
};

function renderDashboard(overview: DashboardOverview, permissions: string[] = []) {
  mocks.permissions = permissions;
  mocks.getDashboardOverview.mockResolvedValue(overview);
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("Dashboard por rol", () => {
  beforeEach(() => {
    mocks.getDashboardOverview.mockReset();
    mocks.getDashboardSeries.mockReset();
    mocks.getDashboardSeries.mockResolvedValue({ months: [], by_status: [] });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  });

  it("saluda por el nombre", async () => {
    renderDashboard(STUDENT);
    expect(await screen.findByText(/, Lucía$/)).toBeInTheDocument();
  });

  it("estudiante: sus casos, pendientes y el banco, sin estadísticas de facultad", async () => {
    renderDashboard(STUDENT);
    const cases = await screen.findByRole("region", { name: "Mis casos" });
    expect(within(cases).getByRole("link", { name: /Beto Sincita/ })).toHaveAttribute("href", "/patients/8");
    expect(within(cases).getByText("Sin cita agendada")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Tus pendientes" })).getByText("Agendar cita para Beto Sincita"),
    ).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Casos activos" })).toHaveTextContent("2");
    // Menos diagnósticos por validar es bueno: la flecha baja.
    expect(screen.getByRole("article", { name: "Diagnósticos por validar" })).toHaveTextContent("↓ 50%");
    expect(mocks.getDashboardSeries).not.toHaveBeenCalled();
  });

  it("docente: cola de validación con enlace a Supervisión", async () => {
    renderDashboard({ ...NONE, supervision: SUPERVISION });
    const queue = await screen.findByRole("region", { name: "Cola de validación" });
    expect(within(queue).getByText("Pulpitis irreversible en 36")).toBeInTheDocument();
    expect(within(queue).getByText("hace 2 días")).toBeInTheDocument();
    expect(within(queue).getByRole("link", { name: "Revisar" })).toHaveAttribute("href", "/supervision");
  });

  it("recepción: accesos rápidos solo según sus permisos", async () => {
    renderDashboard({ ...NONE, bank: BANK }, ["patients.create", "patients.view"]);
    const actions = await screen.findByRole("region", { name: "Accesos rápidos" });
    expect(within(actions).getByRole("link", { name: /Registrar paciente/ })).toHaveAttribute(
      "href",
      "/patients/new",
    );
    expect(within(actions).queryByRole("link", { name: /Agendar cita/ })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Espera hasta asignación" })).toHaveTextContent("7.9días");
  });

  it("admin: combina bloques y cambia el período de la gráfica", async () => {
    const user = userEvent.setup();
    renderDashboard({
      ...NONE,
      supervision: SUPERVISION,
      bank: BANK,
      faculty: {
        by_area: [{ area: "Endodoncia", pendiente: 2, en_proceso: 1, finalizado: 0 }],
        bank_demand: [{ treatment: "endo", name: "Endodoncia monorradicular", area: "Endodoncia", count: 6 }],
        status: { pendiente: 21, en_proceso: 17, finalizado: 8 },
        occupancy,
      },
    });
    expect(
      await screen.findByRole("region", { name: "Tratamientos más demandados en el banco" }),
    ).toHaveTextContent("Endodoncia monorradicular");
    expect(screen.getByRole("article", { name: "Pendientes" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.getDashboardSeries).toHaveBeenLastCalledWith({ period: "1a" }));
    await user.click(screen.getByRole("button", { name: "Todos" }));
    await waitFor(() => expect(mocks.getDashboardSeries).toHaveBeenLastCalledWith({ period: "todos" }));
  });

  it("soporte: cuentas recientes y por rol", async () => {
    renderDashboard(
      {
        ...NONE,
        accounts: {
          kpis: {
            active: metric(64),
            new_month: metric(2),
            inactive: { value: 3, trend: null, spark: [] },
            roles: { value: 5, trend: null, spark: [] },
          },
          active_by_role: [{ role: "estudiante", label: "Estudiante", count: 48 }],
          inactive: 3,
          new_by_month: months,
          recent: [{ id: 1, name: "Daniela Flores", role_label: "Estudiante", date_joined: "2026-11-01T10:00:00Z" }],
        },
      },
      ["users.view"],
    );
    expect(await screen.findByRole("region", { name: "Cuentas creadas recientemente" })).toHaveTextContent(
      "Daniela Flores",
    );
    expect(within(screen.getByRole("region", { name: "Accesos rápidos" })).getAllByRole("link")).toHaveLength(1);
  });

  it("sin bloques muestra un mensaje en vez de una pantalla vacía", async () => {
    renderDashboard(NONE);
    expect(await screen.findByText(/Tu rol no tiene indicadores en el dashboard/)).toBeInTheDocument();
  });

  it("si falla la carga permite reintentar", async () => {
    const user = userEvent.setup();
    mocks.getDashboardOverview.mockRejectedValueOnce(new Error("x")).mockResolvedValue(STUDENT);
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("region", { name: "Mis casos" })).toBeInTheDocument();
  });
});
