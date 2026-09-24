import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../context/ThemeContext";
import { Dashboard } from "./Dashboard";

const api = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
  getDashboardSeries: vi.fn(),
}));

vi.mock("../../services/dashboard", async () => {
  const actual = await vi.importActual<typeof import("../../services/dashboard")>(
    "../../services/dashboard",
  );
  return {
    ...actual,
    getDashboardSummary: api.getDashboardSummary,
    getDashboardSeries: api.getDashboardSeries,
  };
});

const summary = {
  total_patients: 14,
  total_assignments: 2,
  total_clinical_records: 0,
  patients_by_status: { pendiente: 5, en_proceso: 6, finalizado: 3 },
  pending_validations: 7,
};

const series = {
  months: [
    { month: "2026-08", label: "Ago 26", patients: 2, assignments: 1 },
    { month: "2026-09", label: "Sep 26", patients: 3, assignments: 2 },
  ],
  pending_by_area: [
    { area: "Endodoncia", count: 3 },
    { area: "Sin área", count: 2 },
  ],
  student_load: [{ student: "Maria Lopez", active_cases: 2 }],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Dashboard />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    api.getDashboardSummary.mockReset();
    api.getDashboardSeries.mockReset();
    api.getDashboardSummary.mockResolvedValue(summary);
    api.getDashboardSeries.mockResolvedValue(series);
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

  it("carga tarjetas y gráficas del período 1A", async () => {
    renderDashboard();

    expect(await screen.findByText("14")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ingresos y asignaciones por mes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pendientes por área clínica" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Carga por estudiante" })).toBeInTheDocument();
    expect(api.getDashboardSummary).toHaveBeenCalledWith({ period: "1a" });
    expect(api.getDashboardSeries).toHaveBeenCalledWith({ period: "1a" });
  });

  it("expone los datos de cada gráfica en una tabla accesible", async () => {
    renderDashboard();
    await screen.findByText("14");

    const areas = screen.getByRole("table", { name: "Pendientes por área clínica" });
    expect(within(areas).getByRole("rowheader", { name: "Endodoncia" })).toBeInTheDocument();
    const load = screen.getByRole("table", { name: "Carga por estudiante" });
    expect(within(load).getByRole("rowheader", { name: "Maria Lopez" })).toBeInTheDocument();
  });

  it("el filtro de período aplica a tarjetas y gráficas", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("14");

    await user.click(screen.getByRole("button", { name: "1M" }));
    await waitFor(() => {
      expect(api.getDashboardSummary).toHaveBeenCalledWith({ period: "1m" });
      expect(api.getDashboardSeries).toHaveBeenCalledWith({ period: "1m" });
    });

    await user.click(screen.getByRole("button", { name: "Todos" }));
    await waitFor(() => {
      expect(api.getDashboardSeries).toHaveBeenLastCalledWith({});
    });
  });
});
