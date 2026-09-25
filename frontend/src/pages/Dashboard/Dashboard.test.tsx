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
  total_assignments: 11,
  total_clinical_records: 0,
  patients_by_status: { pendiente: 5, en_proceso: 6, finalizado: 3 },
  pending_validations: 7,
  average_wait_days: 4,
};

const series = {
  months: [
    { month: "2026-08", label: "Ago 26", patients: 2, assignments: 1 },
    { month: "2026-09", label: "Sep 26", patients: 3, assignments: 2 },
  ],
  by_area: [
    { area: "Endodoncia", pendiente: 2, en_proceso: 1, finalizado: 1 },
    { area: "Ortodoncia", pendiente: 0, en_proceso: 0, finalizado: 0 },
  ],
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

    expect(
      await screen.findByRole("heading", { name: "Ingresos y asignaciones por mes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Estado de los pacientes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pacientes por área clínica" })).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("días")).toBeInTheDocument();
    expect(api.getDashboardSummary).toHaveBeenCalledWith({ period: "1a" });
    expect(api.getDashboardSeries).toHaveBeenCalledWith({ period: "1a" });
  });

  it("expone los pacientes por área y estado en una tabla accesible", async () => {
    renderDashboard();

    const table = await screen.findByRole("table", { name: "Pacientes por área clínica" });
    const endodoncia = within(table).getByRole("row", { name: /Endodoncia/ });
    expect(within(endodoncia).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "2",
      "1",
      "1",
    ]);
  });

  it("muestra un guion si todavía no hay espera que calcular", async () => {
    api.getDashboardSummary.mockResolvedValue({ ...summary, average_wait_days: null });
    renderDashboard();

    expect(await screen.findByText("—")).toBeInTheDocument();
    expect(screen.queryByText("días")).not.toBeInTheDocument();
  });

  it("la dona muestra cantidad y porcentaje de cada estado", async () => {
    renderDashboard();

    const legend = await screen.findByRole("list", { name: "Pacientes por estado" });
    const rows = within(legend).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Pendientes536%",
      "En proceso643%",
      "Finalizados321%",
    ]);
  });

  it("el filtro de período aplica a tarjetas y gráficas", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole("heading", { name: "Estado de los pacientes" });

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
