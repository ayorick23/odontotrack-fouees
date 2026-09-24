import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PatientClinicalTabs } from "./PatientClinicalTabs";

const api = vi.hoisted(() => ({
  listDiagnoses: vi.fn(),
  listTreatments: vi.fn(),
  listEvolutions: vi.fn(),
  createDiagnosis: vi.fn(),
  createTreatment: vi.fn(),
  createEvolution: vi.fn(),
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 7,
      username: "estudiante",
      first_name: "Ana",
      last_name: "Estudiante",
      email: "",
      role: "estudiante",
      permissions: [
        "diagnoses.view",
        "diagnoses.create",
        "treatments.view",
        "treatments.create",
        "evolution.view",
        "evolution.create",
      ],
    },
  }),
}));

vi.mock("../../services/clinicalRecords", () => ({
  listDiagnoses: api.listDiagnoses,
  listTreatments: api.listTreatments,
  listEvolutions: api.listEvolutions,
  createDiagnosis: api.createDiagnosis,
  createTreatment: api.createTreatment,
  createEvolution: api.createEvolution,
}));

const areas = [
  {
    id: 1,
    slug: "endodoncia",
    name: "Endodoncia",
    is_active: true,
    sort_order: 1,
    treatments: [
      {
        id: 10,
        slug: "pulpectomia",
        name: "Pulpectomía",
        is_active: true,
        sort_order: 1,
      },
    ],
  },
];

describe("PatientClinicalTabs", () => {
  beforeEach(() => {
    api.listDiagnoses.mockReset();
    api.listTreatments.mockReset();
    api.listEvolutions.mockReset();
    api.listDiagnoses.mockResolvedValue([
      {
        id: 1,
        patient: 4,
        student: 7,
        student_name: "Ana Estudiante",
        content: "Caries en pieza 16.",
        validated_by: null,
        validated_by_name: null,
        is_validated: false,
        validated_at: null,
        created_at: "2026-09-22T12:00:00Z",
        updated_at: "2026-09-22T12:00:00Z",
      },
    ]);
    api.listTreatments.mockResolvedValue([
      {
        id: 2,
        patient: 4,
        clinical_area: 1,
        clinical_area_name: "Endodoncia",
        clinical_treatment: 10,
        clinical_treatment_name: "Pulpectomía",
        created_at: "2026-09-22T12:00:00Z",
        updated_at: "2026-09-22T12:00:00Z",
      },
    ]);
    api.listEvolutions.mockResolvedValue([]);
  });

  it("carga el diagnóstico y cambia a tratamientos contra su endpoint", async () => {
    const user = userEvent.setup();
    render(
      <PatientClinicalTabs
        patientId={4}
        areas={areas}
        clinicalAreaSlug="endodoncia"
        clinicalTreatmentSlug="pulpectomia"
      />,
    );

    expect(await screen.findByText("Caries en pieza 16.")).toBeInTheDocument();
    expect(api.listDiagnoses).toHaveBeenCalledWith(4);

    await user.click(screen.getByRole("button", { name: "Tratamientos" }));
    expect(await screen.findByText("Endodoncia · 22 sep 2026")).toBeInTheDocument();
    expect(api.listTreatments).toHaveBeenCalledWith(4);

    await user.click(screen.getByRole("button", { name: "Evolución clínica" }));
    expect(
      await screen.findByText("Aún no hay notas de evolución."),
    ).toBeInTheDocument();
    expect(api.listEvolutions).toHaveBeenCalledWith(4);
  });

  it("registra un diagnóstico nuevo", async () => {
    const user = userEvent.setup();
    api.createDiagnosis.mockResolvedValue({
      id: 9,
      patient: 4,
      student: 7,
      student_name: "Ana Estudiante",
      content: "Fractura en 21.",
      validated_by: null,
      validated_by_name: null,
      is_validated: false,
      validated_at: null,
      created_at: "2026-09-23T12:00:00Z",
      updated_at: "2026-09-23T12:00:00Z",
    });

    render(
      <PatientClinicalTabs
        patientId={4}
        areas={areas}
        clinicalAreaSlug="endodoncia"
        clinicalTreatmentSlug="pulpectomia"
      />,
    );
    await screen.findByText("Caries en pieza 16.");

    await user.type(
      screen.getByPlaceholderText("Describe el diagnóstico clínico"),
      "Fractura en 21.",
    );
    await user.click(screen.getByRole("button", { name: "Registrar diagnóstico" }));

    await waitFor(() => {
      expect(api.createDiagnosis).toHaveBeenCalledWith({
        patient: 4,
        content: "Fractura en 21.",
      });
    });
    expect(await screen.findByText("Fractura en 21.")).toBeInTheDocument();
  });
});
