import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvailablePatients } from "./AvailablePatients";

const api = vi.hoisted(() => ({
  listAvailablePatients: vi.fn(),
  listClinicalAreas: vi.fn(),
  claimAvailablePatient: vi.fn(),
  assignPatient: vi.fn(),
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
    claimAvailablePatient: api.claimAvailablePatient,
    assignPatient: api.assignPatient,
    listAssignableStudents: api.listAssignableStudents,
  };
});

const patient = {
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

const createdAssignment = {
  id: 9,
  patient: 4,
  student: 3,
  appointment_number: 1,
  reason: "Dolor en molar",
  priority: "media",
  status: "activa",
};

describe("AvailablePatients", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listClinicalAreas.mockResolvedValue([]);
    api.listAvailablePatients.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [patient],
    });
  });

  it("lets a student claim an available patient", async () => {
    auth.permissions = ["assignments.claim"];
    api.claimAvailablePatient.mockResolvedValue(createdAssignment);
    const user = userEvent.setup();
    render(<AvailablePatients />);

    expect(await screen.findByText("Ana Disponible")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Elegir" }));
    expect(screen.queryByRole("combobox", { name: "Estudiante" })).toBeNull();
    await user.type(
      screen.getByRole("textbox", { name: /motivo/i }),
      "Dolor en molar",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(api.claimAvailablePatient).toHaveBeenCalledWith({
        patient: 4,
        reason: "Dolor en molar",
        priority: "media",
      });
    });
    expect(api.assignPatient).not.toHaveBeenCalled();
  });

  it("lets reception search a student and assign the patient", async () => {
    auth.permissions = ["assignments.assign_student"];
    api.listAssignableStudents.mockResolvedValue([
      { id: 3, name: "Maria Lopez", active_cases: 1 },
      { id: 5, name: "Jose Ramirez", active_cases: 0 },
    ]);
    api.assignPatient.mockResolvedValue(createdAssignment);
    const user = userEvent.setup();
    render(<AvailablePatients />);

    expect(await screen.findByText("Ana Disponible")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Asignar" }));
    await user.type(
      screen.getByRole("textbox", { name: /motivo/i }),
      "Dolor en molar",
    );
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
      expect(api.assignPatient).toHaveBeenCalledWith({
        patient: 4,
        student: 3,
        reason: "Dolor en molar",
        priority: "media",
      });
    });
    expect(api.claimAvailablePatient).not.toHaveBeenCalled();
  });
});
