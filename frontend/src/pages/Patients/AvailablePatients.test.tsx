import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvailablePatients } from "./AvailablePatients";

const api = vi.hoisted(() => ({
  listAvailablePatients: vi.fn(),
  listClinicalAreas: vi.fn(),
  claimAvailablePatient: vi.fn(),
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

describe("AvailablePatients", () => {
  beforeEach(() => {
    api.listAvailablePatients.mockReset();
    api.listClinicalAreas.mockReset();
    api.claimAvailablePatient.mockReset();
    api.listClinicalAreas.mockResolvedValue([]);
    api.listAvailablePatients.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [patient],
    });
  });

  it("lists available patients and claims one", async () => {
    api.claimAvailablePatient.mockResolvedValue({
      id: 9,
      patient: 4,
      student: 7,
      appointment_number: 1,
      reason: "Dolor en molar",
      priority: "alta",
      status: "activa",
    });
    const user = userEvent.setup();
    render(<AvailablePatients />);

    expect(await screen.findByText("Ana Disponible")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Elegir" }));
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    await user.type(
      screen.getByRole("textbox", { name: "Motivo de ingreso" }),
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
  });
});
