import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvailablePatients } from "./AvailablePatients";

const api = vi.hoisted(() => ({
  listAvailablePatients: vi.fn(),
  listClinicalAreas: vi.fn(),
  claimAvailablePatients: vi.fn(),
  assignPatients: vi.fn(),
  listAssignableStudents: vi.fn(),
}));

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 7, username: "usuario", permissions: auth.permissions },
  }),
}));

vi.mock("../../services/patients", async () => {
  const actual = await vi.importActual<typeof import("../../services/patients")>(
    "../../services/patients",
  );
  return {
    ...actual,
    listAvailablePatients: api.listAvailablePatients,
  };
});

vi.mock("../../services/catalogs", () => ({
  listClinicalAreas: api.listClinicalAreas,
  areaLabel: (_areas: unknown, slug: string) => slug,
}));

vi.mock("../../services/assignments", async () => {
  const actual = await vi.importActual<typeof import("../../services/assignments")>(
    "../../services/assignments",
  );
  return {
    ...actual,
    claimAvailablePatients: api.claimAvailablePatients,
    assignPatients: api.assignPatients,
    listAssignableStudents: api.listAssignableStudents,
  };
});

const ana = {
  id: 4,
  first_name: "Ana",
  last_name: "Disponible",
  dui: "DISP-001",
  phone_number: "7000-0000",
  photo: null,
  clinical_area: "endodoncia",
  clinical_subcategory: "",
  case_status: "pendiente" as const,
  created_at: "2026-09-01T00:00:00Z",
  assigned_to: null,
};

const luis = { ...ana, id: 6, first_name: "Luis", dui: "DISP-002" };

function assignmentFor(patient: number) {
  return {
    id: patient + 100,
    patient,
    student: 3,
    appointment_number: 1,
    reason: "",
    status: "activa",
  };
}

describe("AvailablePatients", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listClinicalAreas.mockResolvedValue([]);
    api.listAvailablePatients.mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [ana, luis],
    });
    api.listAssignableStudents.mockResolvedValue([
      { id: 3, name: "Maria Lopez", active_cases: 1 },
      { id: 5, name: "Jose Ramirez", active_cases: 0 },
    ]);
  });

  it("lets a student claim an available patient", async () => {
    auth.permissions = ["assignments.claim"];
    api.claimAvailablePatients.mockResolvedValue([assignmentFor(4)]);
    const user = userEvent.setup();
    render(<AvailablePatients />);

    expect(await screen.findByText("Ana Disponible")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Elegir" })[0]);
    expect(screen.queryByRole("combobox", { name: "Estudiante" })).toBeNull();
    await user.type(
      screen.getByRole("textbox", { name: /motivo/i }),
      "Dolor en molar",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(api.claimAvailablePatients).toHaveBeenCalledWith({
        patients: [4],
        reason: "Dolor en molar",
      });
    });
    expect(api.assignPatients).not.toHaveBeenCalled();
  });

  it("lets reception search a student and assign the patient", async () => {
    auth.permissions = ["assignments.assign_student"];
    api.assignPatients.mockResolvedValue([assignmentFor(4)]);
    const user = userEvent.setup();
    render(<AvailablePatients />);

    expect(await screen.findByText("Ana Disponible")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Asignar" })[0]);
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();

    await user.type(screen.getByRole("combobox", { name: "Estudiante" }), "mar");
    await waitFor(() => {
      expect(api.listAssignableStudents).toHaveBeenLastCalledWith("mar");
    });
    await user.click(await screen.findByRole("option", { name: /Maria Lopez/ }));
    expect(screen.getByRole("combobox", { name: "Estudiante" })).toHaveValue(
      "Maria Lopez",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(api.assignPatients).toHaveBeenCalledWith({
        patients: [4],
        student: 3,
        reason: "",
      });
    });
    expect(api.claimAvailablePatients).not.toHaveBeenCalled();
  });

  it("assigns several selected patients at once", async () => {
    auth.permissions = ["assignments.assign_student"];
    api.assignPatients.mockResolvedValue([assignmentFor(4), assignmentFor(6)]);
    const user = userEvent.setup();
    render(<AvailablePatients />);

    await user.click(
      await screen.findByRole("checkbox", { name: "Seleccionar a Ana Disponible" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Seleccionar a Luis Disponible" }),
    );
    await user.click(screen.getByRole("button", { name: /Asignar seleccionados \(2\)/ }));

    expect(
      screen.getByRole("heading", { name: "Asignar 2 pacientes" }),
    ).toBeInTheDocument();
    await user.type(screen.getByRole("combobox", { name: "Estudiante" }), "jose");
    await user.click(await screen.findByRole("option", { name: /Jose Ramirez/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(api.assignPatients).toHaveBeenCalledWith({
        patients: [4, 6],
        student: 5,
        reason: "",
      });
    });
  });
});
