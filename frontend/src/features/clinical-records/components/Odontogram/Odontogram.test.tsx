import { render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
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
  // Como la librería real: el clic en un diente solo lo selecciona.
  OdontogramChartSurface: () => (
    <div className="tooth-tile" data-tooth="16">
      <button type="button" onClick={() => engine.notify()}>
        Marcar diente 16
      </button>
    </div>
  ),
  PerioChart: ({ open }: { open?: boolean }) =>
    open ? <div>Carta periodontal</div> : null,
  getActiveRootPerio: engine.getActiveRootPerio,
  getActiveOrtho: engine.getActiveOrtho,
  getActiveDiagnoses: engine.getActiveDiagnoses,
  setPulpEndoForSelection: engine.setPulpEndoForSelection,
  setApicalDxForSelection: engine.setApicalDxForSelection,
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
  setChartMode: engine.setChartMode,
  getPlanChart: engine.getPlanChart,
  setPlanChart: engine.setPlanChart,
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
    {
      slug: "endodoncia",
      name: "Endodoncia",
      id: 1,
      is_active: true,
      sort_order: 1,
      treatments: [
        {
          id: 1,
          slug: "endodoncia_monorradicular",
          name: "Endodoncia monorradicular",
          is_active: true,
          sort_order: 1,
          odontogram_status: "endodoncia",
        },
      ],
    },
  ]),
}));

// El Select de Radix no se puede operar en jsdom: un <select> nativo.
vi.mock("./OdontogramFieldSelect", () => ({
  OdontogramFieldSelect: ({
    label,
    value,
    options = [],
    onChange,
  }: {
    label: string;
    value: string;
    options?: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

import { emptyOdontogram, type OdontogramValue } from "../../types";
import { Odontogram } from "./Odontogram";

/** Odontograma controlado, como en el expediente. */
function Harness({
  onChange,
  initial,
}: {
  onChange?: (value: OdontogramValue) => void;
  initial?: OdontogramValue;
}) {
  const [value, setValue] = useState(() => initial ?? emptyOdontogram());
  return (
    <Odontogram
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

function tooth16(value: OdontogramValue) {
  return value.teeth.find((tooth) => tooth.fdi === 16);
}

function lastValue(onChange: ReturnType<typeof vi.fn>): OdontogramValue {
  return onChange.mock.calls.at(-1)?.[0] as OdontogramValue;
}

describe("Odontogram wrapper", () => {
  beforeEach(() => {
    engine.listeners.length = 0;
    engine.setChart({ version: 2.2, teeth: {} });
    engine.setChartMode("status");
    engine.setChartMode.mockClear();
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
    // Dos vistas; "Hecho" ya no es una pestaña aparte.
    expect(screen.getByRole("button", { name: "Diagnóstico" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Plan de tratamiento" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hecho" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exportar PNG" })).not.toBeInTheDocument();
  });

  it("en solo lectura oculta el panel clínico y deja dientes y hallazgos", () => {
    const value = emptyOdontogram();
    const tooth = tooth16(value);
    if (tooth) {
      tooth.marks = [
        { layer: "hallazgo", status: "caries", surfaces: ["oclusal"] },
        {
          layer: "hecho",
          status: "endodoncia",
          surfaces: [],
          treatment: "endodoncia_monorradicular",
        },
      ];
    }

    render(<Odontogram value={value} readOnly />);

    expect(screen.getByLabelText("Diagnóstico")).toHaveTextContent("16 Caries O");
    // Lo realizado se lista dentro del plan.
    expect(screen.getByLabelText("Plan de tratamiento")).toHaveTextContent(
      /16 endodoncia/i,
    );
    expect(screen.queryByText("Registros especializados")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Volver a pendiente/ }),
    ).not.toBeInTheDocument();
  });

  it("abre el panel de tratamiento al seleccionar un diente", async () => {
    const user = userEvent.setup();
    render(<Odontogram />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    expect(screen.getByText("Diente 16")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Caries" })).toBeInTheDocument();
    expect(screen.getByLabelText("Superficies del diente")).toBeInTheDocument();
  });

  it("seleccionar un diente no cuenta como cambio", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("guarda el estado marcado y lo dibuja (endodoncia ya no se pierde)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    await user.click(screen.getByRole("button", { name: "Endodoncia" }));

    expect(tooth16(lastValue(onChange))?.marks).toEqual([
      { layer: "hallazgo", status: "endodoncia", surfaces: [] },
    ]);
    const drawn = (engine.getChart().teeth as Record<string, Record<string, unknown>>)["16"];
    expect(drawn.endo).toBe("endo-filling");
    expect(screen.getByRole("button", { name: "Endodoncia" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("caries y obturado conviven, cada uno con sus superficies", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    await user.click(screen.getByRole("button", { name: "Caries" }));
    await user.click(screen.getByRole("button", { name: "Obturado" }));

    expect(tooth16(lastValue(onChange))?.marks.map((mark) => mark.status)).toEqual([
      "caries",
      "obturado",
    ]);
  });

  it("en el plan agrega un tratamiento del tarifario y se marca como realizado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    await user.click(screen.getByRole("button", { name: "Plan de tratamiento" }));
    expect(engine.setChartMode).toHaveBeenCalledWith("plan");
    expect(
      screen.queryByRole("button", { name: "Indicado para práctica" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(await screen.findByLabelText("Área clínica"), "endodoncia");
    await user.selectOptions(screen.getByLabelText("Tratamiento"), "endodoncia_monorradicular");
    await user.click(screen.getByRole("button", { name: "Agregar al plan" }));

    expect(tooth16(lastValue(onChange))?.marks).toEqual([
      {
        layer: "plan",
        status: "endodoncia",
        surfaces: [],
        treatment: "endodoncia_monorradicular",
      },
    ]);
    expect(screen.getByLabelText("Plan de tratamiento")).toHaveTextContent(
      "16 Endodoncia monorradicular",
    );

    const realizado = screen.getByRole("checkbox", { name: "Realizado" });
    await user.click(realizado);
    expect(tooth16(lastValue(onChange))?.marks[0].layer).toBe("hecho");
    expect(screen.getByRole("checkbox", { name: "Realizado" })).toBeChecked();

    // Desmarcar lo devuelve a pendiente (vuelve al banco).
    await user.click(screen.getByRole("checkbox", { name: "Realizado" }));
    expect(tooth16(lastValue(onChange))?.marks[0].layer).toBe("plan");
  });

  it("tocar una marca del plan abre la vista del plan", async () => {
    const user = userEvent.setup();
    const value = emptyOdontogram();
    const tooth = tooth16(value);
    if (tooth) {
      tooth.marks = [
        { layer: "plan", status: "endodoncia", surfaces: [], treatment: "endodoncia_monorradicular" },
      ];
    }
    render(<Harness initial={value} onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^16 endodoncia/i }));
    expect(screen.getByRole("button", { name: "Plan de tratamiento" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(engine.setChartMode).toHaveBeenLastCalledWith("plan");
  });

  it("la × de un hallazgo quita solo esa marca", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    await user.click(screen.getByRole("button", { name: "Caries" }));
    await user.click(screen.getByRole("button", { name: "Corona" }));
    await user.click(screen.getByRole("button", { name: "Quitar 16 Caries O" }));

    expect(tooth16(lastValue(onChange))?.marks.map((mark) => mark.status)).toEqual([
      "corona",
    ]);
  });

  it("abre la carta periodontal y las cartas clínicas", async () => {
    const user = userEvent.setup();
    render(<Odontogram />);

    // Plegados por defecto: no se usan en cada consulta.
    expect(screen.queryByRole("tab", { name: "Endodoncia" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registros especializados" }));
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

  it("alterna marcas generales sin perder los dientes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Marcar diente 16" }));
    await user.click(screen.getByRole("button", { name: "Higiene: placa, sangrado, sarro" }));
    await user.click(screen.getByRole("button", { name: "Placa" }));

    const next = lastValue(onChange);
    expect(tooth16(next)?.oralMarks.placa).toBe(true);
    expect(next.oralMarks.placa).toBe(true);
  });
});
