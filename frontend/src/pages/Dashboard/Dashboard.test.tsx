import { render, screen, waitFor } from "@testing-library/react";
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
  total_patients: 4,
  total_assignments: 2,
  total_clinical_records: 0,
  patients_by_status: { pendiente: 1, en_proceso: 2, finalizado: 1 },
};

const series = {
  months: [
    {
      month: "2026-08",
      label: "Ago 26",
      patients: 2,
      pendiente: 1,
      en_proceso: 1,
      finalizado: 0,
      assignments: 1,
    },
    {
      month: "2026-09",
      label: "Sep 26",
      patients: 2,
      pendiente: 0,
      en_proceso: 1,
      finalizado: 1,
      assignments: 1,
    },
  ],
  by_status: [
    { status: "pendiente" as const, label: "Pendiente", count: 1 },
    { status: "en_proceso" as const, label: "En proceso", count: 2 },
    { status: "finalizado" as const, label: "Finalizado", count: 1 },
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

  it("carga KPIs y gráficos reales del período 1A", async () => {
    renderDashboard();

    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Estadísticas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seguimiento de citas" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Estado actual de pacientes" }),
    ).toBeInTheDocument();
    expect(api.getDashboardSummary).toHaveBeenCalled();
    expect(api.getDashboardSeries).toHaveBeenCalledWith({ period: "1a" });
    expect(
      screen.queryByText("Indicadores del banco de pacientes"),
    ).not.toBeInTheDocument();
  });

  it("pide series del último mes al elegir 1M", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("4");

    await user.click(screen.getByRole("button", { name: "1M" }));

    await waitFor(() => {
      expect(api.getDashboardSeries).toHaveBeenCalledWith({ period: "1m" });
    });
  });
});
