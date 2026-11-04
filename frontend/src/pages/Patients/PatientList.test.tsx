import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PatientList } from "./PatientList";

const api = vi.hoisted(() => ({
  listPatients: vi.fn(),
  listAssignees: vi.fn(),
  listClinicalAreas: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  role: "admin",
  permissions: [] as string[],
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 7, username: "usuario", role: auth.role, permissions: auth.permissions },
  }),
}));

// useChartTheme (colores de estado) necesita el tema.
vi.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("../../services/patients", async () => {
  const actual = await vi.importActual<typeof import("../../services/patients")>(
    "../../services/patients",
  );
  return {
    ...actual,
    listPatients: api.listPatients,
    listAssignees: api.listAssignees,
  };
});

vi.mock("../../services/catalogs", () => ({
  listClinicalAreas: api.listClinicalAreas,
  areaLabel: (_areas: unknown, slug: string) => slug,
  treatmentLabel: (_areas: unknown, slug: string) => slug,
}));

const ana = {
  id: 4,
  first_name: "Ana",
  last_name: "Pronto",
  document_type: "dui" as const,
  dui: "01234567-8",
  guardian_dui: "",
  phone_number: "7000-0000",
  photo: null,
  clinical_area: "endodoncia",
  clinical_subcategory: "",
  case_status: "pendiente" as const,
  created_at: "2026-09-01T00:00:00Z",
  assigned_to: null,
  indicated_practices: [],
};

const carla = {
  ...ana,
  id: 6,
  first_name: "Carla",
  dui: "11111111-1",
  case_status: "finalizado" as const,
  assigned_to: "Lucía Zepeda",
};

/** Muestra la URL actual para comprobar los parámetros que pone la página. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderList(initialUrl = "/patients") {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route
          path="/patients"
          element={
            <>
              <PatientList />
              <LocationProbe />
            </>
          }
        />
        <Route path="/patients/:id" element={<p>Ficha abierta</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PatientList", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    auth.role = "admin";
    auth.permissions = ["patients.view", "patients.edit", "patients.delete"];
    api.listClinicalAreas.mockResolvedValue([]);
    api.listAssignees.mockResolvedValue([]);
    api.listPatients.mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [ana, carla],
      status_counts: { pendiente: 5, en_proceso: 3, finalizado: 1 },
    });
  });

  it("muestra los conteos por estado en las pestañas", async () => {
    renderList();
    const tabs = screen.getByRole("group", { name: "Estado del caso" });
    await waitFor(() =>
      expect(within(tabs).getByRole("button", { name: /Todos/ })).toHaveTextContent("9"),
    );
    expect(within(tabs).getByRole("button", { name: /Pendientes/ })).toHaveTextContent("5");
    expect(within(tabs).getByRole("button", { name: /Asignados/ })).toHaveTextContent("3");
    expect(within(tabs).getByRole("button", { name: /Finalizados/ })).toHaveTextContent("1");
  });

  it("elegir una pestaña filtra por estado", async () => {
    renderList();
    await screen.findByText("Ana Pronto");
    await userEvent.click(screen.getByRole("button", { name: /Finalizados/ }));
    await waitFor(() =>
      expect(api.listPatients).toHaveBeenLastCalledWith(
        expect.objectContaining({ caseStatus: "finalizado" }),
      ),
    );
    expect(screen.getByRole("button", { name: /Finalizados/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("ordena por defecto del más reciente y alterna al hacer clic", async () => {
    renderList();
    await screen.findByText("Ana Pronto");
    expect(api.listPatients).toHaveBeenLastCalledWith(
      expect.objectContaining({ ordering: "-created_at" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Paciente" }));
    await waitFor(() =>
      expect(api.listPatients).toHaveBeenLastCalledWith(
        expect.objectContaining({ ordering: "name" }),
      ),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("ordering=name");

    await userEvent.click(screen.getByRole("button", { name: "Paciente" }));
    await waitFor(() =>
      expect(api.listPatients).toHaveBeenLastCalledWith(
        expect.objectContaining({ ordering: "-name" }),
      ),
    );
    expect(screen.getByRole("columnheader", { name: "Paciente" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("hacer clic en la fila abre la ficha", async () => {
    renderList();
    await userEvent.click(await screen.findByText("Ana Pronto"));
    expect(await screen.findByText("Ficha abierta")).toBeInTheDocument();
  });

  it("muestra el documento con su rótulo junto al id y el teléfono", async () => {
    renderList();
    expect(await screen.findByText("#4 · DUI 01234567-8 · 7000-0000")).toBeInTheDocument();
  });

  it("el estudiante no ve el lápiz en sus casos finalizados", async () => {
    auth.role = "estudiante";
    auth.permissions = ["patients.view", "patients.edit"];
    renderList();
    await screen.findByText("Ana Pronto");
    expect(screen.getByRole("link", { name: "Editar a Ana Pronto" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Editar a Carla Pronto" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Edición no disponible" })).toBeInTheDocument();
    // Sin patients.delete no aparece el borrado.
    expect(screen.queryByRole("button", { name: /Borrar/ })).not.toBeInTheDocument();
  });

  it("con filtros sin resultados ofrece limpiarlos", async () => {
    api.listPatients.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
      status_counts: { pendiente: 0, en_proceso: 0, finalizado: 0 },
    });
    renderList("/patients?tooth=36&search=zzz");
    expect(await screen.findByText("Ningún paciente coincide")).toBeInTheDocument();
    const [clear] = screen.getAllByRole("button", { name: /Limpiar filtros/ });
    await userEvent.click(clear);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^$/));
  });
});
