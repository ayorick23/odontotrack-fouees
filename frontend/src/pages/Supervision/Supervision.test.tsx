import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Supervision } from "./Supervision";

const api = vi.hoisted(() => ({
  listPendingDiagnoses: vi.fn(),
  validateDiagnosis: vi.fn(),
  listFinalizableAssignments: vi.fn(),
  listInProgressAssignments: vi.fn(),
  finalizeAssignment: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  permissions: [] as string[],
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 3,
      username: "docente",
      first_name: "Laura",
      last_name: "Docente",
      email: "",
      role: "docente",
      permissions: auth.permissions,
    },
  }),
}));

vi.mock("../../services/clinicalRecords", () => ({
  listPendingDiagnoses: api.listPendingDiagnoses,
  validateDiagnosis: api.validateDiagnosis,
  getClinicalRecordError: (_error: unknown, fallback: string) => fallback,
}));

vi.mock("../../services/assignments", () => ({
  listFinalizableAssignments: api.listFinalizableAssignments,
  listInProgressAssignments: api.listInProgressAssignments,
  finalizeAssignment: api.finalizeAssignment,
  getAssignmentError: () => "No se pudo guardar la asignación.",
}));

const pendingDiagnosis = {
  id: 11,
  patient: 4,
  patient_name: "Rosa Pérez",
  student: 7,
  student_name: "Ana Estudiante",
  content: "Caries en pieza 16.",
  validated_by: null,
  validated_by_name: null,
  is_validated: false,
  validated_at: null,
  created_at: "2026-10-20T15:00:00Z",
  updated_at: "2026-10-20T15:00:00Z",
};

const finalizableCase = {
  id: 21,
  patient: 4,
  patient_name: "Rosa Pérez",
  student_name: "Ana Estudiante",
  appointment_number: 3,
  reason: "Control",
  assigned_date: "2026-10-01",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Supervision />
    </MemoryRouter>,
  );
}

describe("Supervision", () => {
  beforeEach(() => {
    auth.permissions = ["supervision.view", "diagnoses.validate", "assignments.change_status"];
    api.listPendingDiagnoses.mockReset();
    api.validateDiagnosis.mockReset();
    api.listFinalizableAssignments.mockReset();
    api.listInProgressAssignments.mockReset();
    api.finalizeAssignment.mockReset();
    api.listPendingDiagnoses.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [pendingDiagnosis],
    });
    api.listFinalizableAssignments.mockResolvedValue([]);
    api.listInProgressAssignments.mockResolvedValue([]);
  });

  it("muestra los casos en proceso con el estado de su diagnóstico", async ()=>{
    api.listInProgressAssignments.mockResolvedValue([
      { ...finalizableCase, patient_name: "Luis Mejía", diagnosis_state: "pending" },
    ]);
    renderPage();
    
    expect(await screen.findByText("Luis Mejía")).toBeInTheDocument();
    expect(screen.getByText("Por validar")).toBeInTheDocument();
  });

  it("valida un diagnóstico y recarga los casos listos para finalizar", async () => {
    api.validateDiagnosis.mockResolvedValue({ ...pendingDiagnosis, is_validated: true });
    renderPage();

    expect(await screen.findByText("Caries en pieza 16.")).toBeInTheDocument();
    expect(api.listFinalizableAssignments).toHaveBeenCalledTimes(1);

    api.listFinalizableAssignments.mockResolvedValue([finalizableCase]);
    await userEvent.click(screen.getByRole("button", { name: "Validar" }));

    await waitFor(() => expect(api.validateDiagnosis).toHaveBeenCalledWith(11));
    await waitFor(() =>
      expect(screen.queryByText("Caries en pieza 16.")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("No hay diagnósticos pendientes de validar.")).toBeInTheDocument();
    expect(api.listFinalizableAssignments).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("button", { name: "Finalizar caso" })).toBeInTheDocument();
  });

  it("finaliza un caso tras confirmar", async () => {
    api.listFinalizableAssignments.mockResolvedValue([finalizableCase]);
    api.finalizeAssignment.mockResolvedValue({ id: 21, status: "finalizada" });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Finalizar caso" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Rosa Pérez/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Finalizar caso" }));

    await waitFor(() => expect(api.finalizeAssignment).toHaveBeenCalledWith(21));
    expect(
      await screen.findByText("No hay casos activos con diagnóstico validado."),
    ).toBeInTheDocument();
  });

  it("sin permiso de cambiar estado no muestra los casos a finalizar", async () => {
    auth.permissions = ["supervision.view", "diagnoses.validate"];
    renderPage();

    expect(await screen.findByText("Caries en pieza 16.")).toBeInTheDocument();
    expect(screen.queryByText("Casos listos para finalizar")).not.toBeInTheDocument();
    expect(api.listFinalizableAssignments).not.toHaveBeenCalled();
  });

  it("sin permiso de validar no muestra el botón", async () => {
    auth.permissions = ["supervision.view"];
    renderPage();

    expect(await screen.findByText("Caries en pieza 16.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Validar" })).not.toBeInTheDocument();
  });
});
