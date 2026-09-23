import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => {
  const listeners: Array<() => void> = [];
  let chart: Record<string, unknown> = { version: 2.2, teeth: {} };
  let chartMode: "status" | "plan" = "status";

  return {
    listeners,
    getChart: () => chart,
    setChart: (next: Record<string, unknown>) => {
      chart = next;
    },
    getChartMode: () => chartMode,
    setChartMode: vi.fn((mode: "status" | "plan") => {
      chartMode = mode;
    }),
    notify: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    resetTooth: vi.fn(),
    setToothSelectionForSelection: vi.fn(),
    setCariesSurfaceForSelection: vi.fn(),
    setFillingMaterialForSelection: vi.fn(),
    setFillingSurfaceForSelection: vi.fn(),
    setRestorationForSelection: vi.fn(),
    setWisdomVisible: vi.fn(),
    setShowBase: vi.fn(),
    setOcclusalVisible: vi.fn(),
    setHealthyPulpVisible: vi.fn(),
    clearSelection: vi.fn(),
    getPlanChanges: vi.fn(() => []),
    getPlanChart: vi.fn(() => ({ version: 2.2, teeth: {} })),
    setPlanChart: vi.fn(),
    exportImage: vi.fn(async () => undefined),
    exportPdf: vi.fn(async () => undefined),
    exportFhir: vi.fn(() => ({ resourceType: "Bundle" })),
    setPdfSettings: vi.fn(),
    getActiveRootPerio: vi.fn(() => ({
      sectionVisible: true,
      rootBlockVisible: true,
      pulpEndoValue: "normal",
      pulpEndoNoneOption: { value: "normal", label: "Normal" },
      pulpEndoGroups: [
        {
          label: "Pulpa vital",
          options: [{ value: "normal", label: "Normal" }],
        },
      ],
      pulpEndoDisabled: false,
      apicalDxValue: "",
      apicalDxOptions: [],
      apicalDxDisabled: true,
      apicalDxRowVisible: false,
      mods: [],
      calculusChecked: false,
      calculusRowVisible: true,
    })),
    getActiveOrtho: vi.fn(() => ({
      appliance: "none",
      drift: "none",
      vertical: "none",
      rotation: false,
      visible: true,
    })),
    getActiveDiagnoses: vi.fn(() => ({
      visible: true,
      rows: [],
      addableKeys: [{ key: "fluorosis", icd10: "K00.3" }],
    })),
    setPulpEndoForSelection: vi.fn(),
    setApicalDxForSelection: vi.fn(),
    setCalculusForSelection: vi.fn(),
    setModForSelection: vi.fn(),
    setOrthoApplianceForSelection: vi.fn(),
    setOrthoDriftForSelection: vi.fn(),
    setOrthoVerticalForSelection: vi.fn(),
    setOrthoRotationForSelection: vi.fn(),
    addDiagnosisToSelection: vi.fn(),
    removeDiagnosisFromSelection: vi.fn(),
  };
});

vi.mock("react-advanced-odontogram", () => ({
  OdontogramProvider: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  OdontogramChartSurface: () => (
    <button
      type="button"
      onClick={() => {
        engine.setChart({
          version: 2.2,
          teeth: {
            "16": {
              toothSelection: "tooth-base",
              caries: ["caries-occlusal"],
            },
          },
        });
        engine.notify();
      }}
    >
      Marcar diente 16
    </button>
  ),
  PerioChart: ({ open }: { open?: boolean }) =>
    open ? <div>Carta periodontal</div> : null,
  getActiveRootPerio: engine.getActiveRootPerio,
  getActiveOrtho: engine.getActiveOrtho,
  getActiveDiagnoses: engine.getActiveDiagnoses,
  setPulpEndoForSelection: engine.setPulpEndoForSelection,
  setApicalDxForSelection: engine.setApicalDxForSelection,
  setCalculusForSelection: engine.setCalculusForSelection,
  setModForSelection: engine.setModForSelection,
  setOrthoApplianceForSelection: engine.setOrthoApplianceForSelection,
  setOrthoDriftForSelection: engine.setOrthoDriftForSelection,
  setOrthoVerticalForSelection: engine.setOrthoVerticalForSelection,
  setOrthoRotationForSelection: engine.setOrthoRotationForSelection,
  addDiagnosisToSelection: engine.addDiagnosisToSelection,
  removeDiagnosisFromSelection: engine.removeDiagnosisFromSelection,
  setHealthyPulpVisible: engine.setHealthyPulpVisible,
  onStateChange: (callback: () => void) => {
    engine.listeners.push(callback);
    return () => {
      const index = engine.listeners.indexOf(callback);
      if (index >= 0) {
        engine.listeners.splice(index, 1);
      }
    };
  },
  getStatusChart: () => engine.getChart(),
  importStatus: (payload: unknown) => {
    engine.setChart(payload as Record<string, unknown>);
    engine.notify();
  },
  getChartMode: engine.getChartMode,
  setChartMode: engine.setChartMode,
  getPlanChanges: engine.getPlanChanges,
  getPlanChart: engine.getPlanChart,
  setPlanChart: engine.setPlanChart,
  setToothSelectionForSelection: engine.setToothSelectionForSelection,
  setRestorationForSelection: engine.setRestorationForSelection,
  setCariesSurfaceForSelection: engine.setCariesSurfaceForSelection,
  setFillingMaterialForSelection: engine.setFillingMaterialForSelection,
  setFillingSurfaceForSelection: engine.setFillingSurfaceForSelection,
  resetTooth: engine.resetTooth,
  setWisdomVisible: engine.setWisdomVisible,
  setShowBase: engine.setShowBase,
  setOcclusalVisible: engine.setOcclusalVisible,
  clearSelection: engine.clearSelection,
  exportImage: engine.exportImage,
  exportPdf: engine.exportPdf,
  exportFhir: engine.exportFhir,
  setPdfSettings: engine.setPdfSettings,
}));

vi.mock("react-advanced-odontogram/style.css", () => ({}));

vi.mock("../../../../services/catalogs", () => ({
  listClinicalAreas: vi.fn(async () => [
    { slug: "operatoria", name: "Operatoria", id: 1, is_active: true, sort_order: 1, treatments: [] },
  ]),
}));

import { emptyOdontogram } from "../../types";
import { applyToothLayer } from "./engine";
import { Odontogram } from "./Odontogram";

describe("Odontogram wrapper", () => {
  beforeEach(() => {
    engine.listeners.length = 0;
    engine.setChart({ version: 2.2, teeth: {} });
    applyToothLayer("hallazgo");
    engine.setChartMode("status");
    engine.setChartMode.mockClear();
    engine.resetTooth.mockClear();
    engine.setToothSelectionForSelection.mockClear();
    engine.setCariesSurfaceForSelection.mockClear();
    engine.setFillingMaterialForSelection.mockClear();
    engine.getPlanChanges.mockReturnValue([]);
    engine.exportFhir.mockClear();
    engine.exportPdf.mockClear();
    engine.exportImage.mockClear();
    URL.createObjectURL = vi.fn(() => "blob:odontogram") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  });

  it("renderiza el odontograma y el panel de tratamiento", () => {
    render(<Odontogram />);
    expect(
      screen.getByRole("button", { name: "Marcar diente 16" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ningún diente seleccionado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Caries" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oclusal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hueso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pulpa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hallazgo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hecho" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exportar PNG" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "FHIR" })).not.toBeInTheDocument();
  });

  it("en solo lectura oculta el panel clínico y deja dientes y hallazgos", () => {
    const value = emptyOdontogram();
    const tooth = value.teeth.find((item) => item.fdi === 16);
    if (tooth) {
      tooth.marks = [{ layer: "hecho", status: "implante", surfaces: [] }];
      tooth.oralMarks = { placa: false, sangrado: false, sarro: false };
      tooth.practice = { indicated: false, clinicalArea: null };
    }

    render(<Odontogram value={value} readOnly />);

    expect(
      screen.getByRole("button", { name: "Marcar diente 16" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Hallazgos del odontograma")).toHaveTextContent(
      "16 Implante",
    );
    expect(screen.getByLabelText("Hecho")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Tratamiento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Caries" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exportar PNG" })).not.toBeInTheDocument();
  });

  it("abre el panel de tratamiento al marcar un diente", async () => {
    const user = userEvent.setup();
    render(<Odontogram />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    expect(screen.getByRole("button", { name: "Caries" })).toBeInTheDocument();
    expect(screen.getByText("Patología")).toBeInTheDocument();
    expect(screen.getByText("Pieza")).toBeInTheDocument();
    expect(screen.getByLabelText("Superficies del diente")).toBeInTheDocument();
  });

  it("cambia al modo plan de tratamiento", async () => {
    const user = userEvent.setup();
    render(<Odontogram />);
    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(engine.setChartMode).toHaveBeenCalledWith("plan");
  });

  it("abre la carta periodontal y las cartas clínicas", async () => {
    const user = userEvent.setup();
    render(<Odontogram />);

    await user.click(screen.getByRole("tab", { name: "Endodoncia" }));
    expect(screen.getByText("Estado pulpar / endodoncia")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Periodoncia" }));
    await user.click(
      screen.getByRole("button", { name: "Abrir carta periodontal" }),
    );
    expect(screen.getByText("Carta periodontal")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Ortodoncia" }));
    expect(screen.getByText("Aparato de ortodoncia")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "ICD-10" }));
    expect(screen.getByText("Añadir diagnóstico")).toBeInTheDocument();
  });

  it("dispara onChange con el formato de dominio al marcar un diente", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Odontogram onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));

    expect(onChange).toHaveBeenCalled();
    const value = onChange.mock.calls.at(-1)?.[0];
    expect(value.teeth.find((tooth: { fdi: number }) => tooth.fdi === 16)).toEqual(
      {
        fdi: 16,
        marks: [{ layer: "hallazgo", status: "caries", surfaces: ["oclusal"] }],
        oralMarks: { placa: false, sangrado: false, sarro: false },
        practice: { indicated: false, clinicalArea: null },
      },
    );
    expect(value.oralMarks).toEqual({
      placa: false,
      sangrado: false,
      sarro: false,
    });
  });

  it("aplica un estado FOUEES a la selección", async () => {
    const user = userEvent.setup();
    render(<Odontogram value={emptyOdontogram()} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    await user.click(screen.getByRole("button", { name: "Caries" }));
    expect(engine.resetTooth).not.toHaveBeenCalled();
    expect(engine.setToothSelectionForSelection).not.toHaveBeenCalled();
    expect(engine.setCariesSurfaceForSelection).toHaveBeenCalledWith(
      "caries-occlusal",
      true,
    );
  });

  it("aplica obturado con material para que se vea en la carta", async () => {
    const user = userEvent.setup();
    render(<Odontogram value={emptyOdontogram()} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    await user.click(screen.getByRole("button", { name: "Obturado" }));
    expect(engine.setFillingMaterialForSelection).toHaveBeenCalledWith(
      "composite",
    );
    expect(engine.setFillingSurfaceForSelection).toHaveBeenCalledWith(
      "occlusal",
      true,
    );
  });

  it("puede sumar obturado sobre un diente con caries", async () => {
    const user = userEvent.setup();
    render(<Odontogram value={emptyOdontogram()} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    await user.click(screen.getByRole("button", { name: "Caries" }));
    await user.click(screen.getByRole("button", { name: "Obturado" }));
    expect(engine.setCariesSurfaceForSelection).toHaveBeenCalled();
    expect(engine.setFillingMaterialForSelection).toHaveBeenCalledWith(
      "composite",
    );
    expect(engine.setToothSelectionForSelection).not.toHaveBeenCalled();
  });

  it("alterna marcas generales sin perder los dientes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = emptyOdontogram();

    render(<Odontogram value={value} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    await user.click(screen.getByRole("button", { name: "Más opciones" }));
    await user.click(screen.getByRole("button", { name: "Placa" }));

    const next = onChange.mock.calls.at(-1)?.[0];
    const tooth = next.teeth.find((item: { fdi: number }) => item.fdi === 16);
    expect(tooth.oralMarks.placa).toBe(true);
    expect(next.oralMarks.placa).toBe(true);
  });
});
