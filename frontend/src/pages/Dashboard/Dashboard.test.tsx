import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../context/ThemeContext";
import type { DashboardOverview } from "../../services/dashboard";
import { Dashboard } from "./Dashboard";

const api = vi.hoisted(() => ({
  getDashboardOverview: vi.fn(),
  getDashboardSeries: vi.fn(),
}));

vi.mock("../../services/dashboard", async () => {
  const actual = await vi.importActual<typeof import("../../services/dashboard")>(
    "../../services/dashboard",
  );
  return {
    ...actual,
    getDashboardOverview: api.getDashboardOverview,
    getDashboardSeries: api.getDashboardSeries,
  };
});

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
    cases: [
      { patient_id: 7, patient_name: "Ana Pronto", next_appointment: "2026-11-03T15:00:00Z" },
      { patient_id: 8, patient_name: "Beto Sincita", next_appointment: null },
    ],
    upcoming_appointments: [
      { id: 1, starts_at: "2026-11-03T15:00:00Z", patient_id: 7, patient_name: "Ana Pronto" },
    ],
    diagnoses_awaiting_validation: 2,
    bank_available: 21,
    done_treatments_in_my_cases: 3,
  },
};

const indicator = { percent: 50, count: 1, total: 2 };

const ADMIN: DashboardOverview = {
  my_cases: null,
  supervision: {
    diagnoses_to_validate: 4,
    cases_in_progress: 9,
    students_with_active_cases: 3,
    indicators: {
      digitalization: indicator,
      validated_diagnoses: indicator,
      cases_with_validated_diagnosis: indicator,
    },
  },
  bank: {
    unassigned: 21,
    registered_this_month: 5,
    today_appointments: [],
    average_wait_days: 7.9,
  },
  faculty: {
    by_area: [{ area: "Endodoncia", pendiente: 2, en_proceso: 1, finalizado: 0 }],
    bank_demand: [
      { treatment: "endo", name: "Endodoncia monorradicular", area: "Endodoncia", count: 3 },
    ],
  },
  accounts: {
    active_by_role: [{ role: "estudiante", label: "Estudiante", count: 2 }],
    inactive: 1,
  },
};

function renderDashboard() {
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
    api.getDashboardOverview.mockReset();
    api.getDashboardSeries.mockReset();
    api.getDashboardSeries.mockResolvedValue({ months: [], by_status: [] });
    // jsdom no trae matchMedia (tema) ni ResizeObserver (gráficas).
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  it("el estudiante ve sus casos y enlaces directos, sin estadísticas", async () => {
    api.getDashboardOverview.mockResolvedValue(STUDENT);
    renderDashboard();

    const block = await screen.findByRole("region", { name: "Mis casos" });
    expect(within(block).getByRole("link", { name: /Disponibles en el banco/ })).toHaveAttribute(
      "href",
      "/assignments",
    );
    expect(within(block).getByRole("link", { name: /Beto Sincita/ })).toHaveAttribute(
      "href",
      "/patients/8",
    );
    expect(within(block).getByText("Sin cita agendada")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Supervisión" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Facultad" })).not.toBeInTheDocument();
    // Las series solo se piden para el bloque Facultad.
    expect(api.getDashboardSeries).not.toHaveBeenCalled();
  });

  it("el admin ve supervisión, banco, cuentas y facultad", async () => {
    const user = userEvent.setup();
    api.getDashboardOverview.mockResolvedValue(ADMIN);
    renderDashboard();

    const supervision = await screen.findByRole("region", { name: "Supervisión" });
    expect(
      within(supervision).getByRole("link", { name: /Diagnósticos por validar/ }),
    ).toHaveAttribute("href", "/supervision");
    expect(screen.getByRole("region", { name: "Banco y agenda" })).toHaveTextContent("7.9");
    expect(screen.getByRole("region", { name: "Cuentas" })).toHaveTextContent("Desactivadas");
    expect(screen.getByText("Tratamientos más demandados en el banco")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Mis casos" })).not.toBeInTheDocument();

    expect(api.getDashboardSeries).toHaveBeenLastCalledWith({ period: "1a" });
    await user.click(screen.getByRole("button", { name: "Todos" }));
    expect(api.getDashboardSeries).toHaveBeenLastCalledWith({ period: "todos" });
  });

  it("sin bloques muestra un mensaje en vez de una pantalla vacía", async () => {
    api.getDashboardOverview.mockResolvedValue(NONE);
    renderDashboard();
    expect(
      await screen.findByText(/Tu rol no tiene indicadores en el dashboard/),
    ).toBeInTheDocument();
  });

  it("si falla la carga permite reintentar", async () => {
    const user = userEvent.setup();
    api.getDashboardOverview.mockRejectedValueOnce(new Error("x")).mockResolvedValue(STUDENT);
    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("region", { name: "Mis casos" })).toBeInTheDocument();
  });
});
