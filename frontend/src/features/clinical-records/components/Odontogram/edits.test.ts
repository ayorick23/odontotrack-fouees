import { describe, expect, it } from "vitest";

import {
  emptyOdontogram,
  updateTooth,
  type OdontogramValue,
  type PracticeTreatment,
  type ToothMark,
} from "../../types";
import {
  addPlannedTreatment,
  layerStatuses,
  removeMark,
  setDone,
  setMarkSurface,
  toggleStatus,
  toggleSurface,
} from "./edits";

const ENDO: PracticeTreatment = {
  slug: "endodoncia_monorradicular",
  name: "Endodoncia monorradicular",
  odontogramStatus: "endodoncia",
};
const RESINA: PracticeTreatment = {
  slug: "resina_una_superficie_adulto",
  name: "Resina de una superficie (adulto)",
  odontogramStatus: "obturado",
};
const EXODONCIA: PracticeTreatment = {
  slug: "exodoncia_simple_diente_permanente",
  name: "Exodoncia simple",
  odontogramStatus: "extraido",
};
const DIAGNOSTICO: PracticeTreatment = {
  slug: "diagnostico_con_rx_panoramica",
  name: "Diagnóstico con RX panorámica",
  odontogramStatus: null,
};

function marks(value: OdontogramValue, fdi = 18): ToothMark[] {
  return value.teeth.find((tooth) => tooth.fdi === fdi)?.marks ?? [];
}

function start(...initial: ToothMark[]): OdontogramValue {
  return updateTooth(emptyOdontogram(), 18, { marks: initial });
}

describe("toggleStatus", () => {
  it("guarda exactamente el estado marcado (antes se deducía del dibujo)", () => {
    for (const status of [
      "endodoncia",
      "pulpotomia",
      "raiz_retenida",
      "no_erupcionado",
      "ausente_congenito",
      "fractura",
    ] as const) {
      expect(marks(toggleStatus(start(), 18, "hallazgo", status))).toEqual([
        { layer: "hallazgo", status, surfaces: [] },
      ]);
    }
    for (const status of ["sellante", "restauracion_temporal"] as const) {
      expect(marks(toggleStatus(start(), 18, "hallazgo", status))).toEqual([
        { layer: "hallazgo", status, surfaces: ["oclusal"] },
      ]);
    }
  });

  it("el segundo clic quita el estado", () => {
    const once = toggleStatus(start(), 18, "hallazgo", "endodoncia");
    expect(marks(toggleStatus(once, 18, "hallazgo", "endodoncia"))).toEqual([]);
  });

  it("sano limpia solo esa capa", () => {
    const value = start(
      { layer: "hallazgo", status: "caries", surfaces: ["oclusal"] },
      { layer: "plan", status: "corona", surfaces: [], treatment: "corona_metal_porcelana" },
    );
    expect(marks(toggleStatus(value, 18, "hallazgo", "sano"))).toEqual([
      { layer: "plan", status: "corona", surfaces: [], treatment: "corona_metal_porcelana" },
    ]);
  });

  it("un estado de pieza completa ocupa su capa y viceversa", () => {
    const caries = start({ layer: "hallazgo", status: "caries", surfaces: ["oclusal"] });
    const extracted = toggleStatus(caries, 18, "hallazgo", "extraido");
    expect(layerStatuses(extracted, 18, "hallazgo")).toEqual(["extraido"]);
    const again = toggleStatus(extracted, 18, "hallazgo", "caries");
    expect(layerStatuses(again, 18, "hallazgo")).toEqual(["caries"]);
  });
});

describe("superficies", () => {
  it("crea la marca al tocar una superficie y la quita al vaciarla", () => {
    const one = toggleSurface(start(), 18, "hallazgo", "caries", "mesial", true);
    expect(marks(one)).toEqual([{ layer: "hallazgo", status: "caries", surfaces: ["mesial"] }]);
    expect(marks(toggleSurface(one, 18, "hallazgo", "caries", "mesial", false))).toEqual([]);
  });

  it("una marca con tratamiento queda aunque se quede sin superficies", () => {
    const planned = addPlannedTreatment(start(), 18, RESINA);
    const cleared = setMarkSurface(planned, 18, 0, "oclusal", false);
    expect(marks(cleared)).toEqual([
      { layer: "plan", status: "obturado", surfaces: [], treatment: RESINA.slug },
    ]);
  });
});

describe("plan", () => {
  it("planifica con el símbolo del tarifario y sin duplicar", () => {
    const once = addPlannedTreatment(start(), 18, ENDO);
    expect(marks(once)).toEqual([
      { layer: "plan", status: "endodoncia", surfaces: [], treatment: ENDO.slug },
    ]);
    expect(addPlannedTreatment(once, 18, ENDO)).toBe(once);
  });

  it("acepta tratamientos sin dibujo", () => {
    expect(marks(addPlannedTreatment(start(), 18, DIAGNOSTICO))).toEqual([
      { layer: "plan", status: null, surfaces: [], treatment: DIAGNOSTICO.slug },
    ]);
  });

  it("una exodoncia planificada reemplaza el resto del plan, no los hallazgos", () => {
    const value = addPlannedTreatment(
      start({ layer: "hallazgo", status: "caries", surfaces: ["oclusal"] }),
      18,
      RESINA,
    );
    const extraction = addPlannedTreatment(value, 18, EXODONCIA);
    expect(marks(extraction).map((mark) => [mark.layer, mark.status])).toEqual([
      ["hallazgo", "caries"],
      ["plan", "extraido"],
    ]);
  });

  it("Realizado conserva tratamiento y superficies, y se puede desmarcar", () => {
    const planned = addPlannedTreatment(start(), 18, RESINA);
    const done = setDone(planned, 18, 0, true);
    expect(marks(done)).toEqual([
      { layer: "hecho", status: "obturado", surfaces: ["oclusal"], treatment: RESINA.slug },
    ]);
    expect(marks(setDone(done, 18, 0, false))).toEqual(marks(planned));
  });

  it("Realizado solo aplica a tratamientos del plan", () => {
    const finding = start({ layer: "hallazgo", status: "caries", surfaces: ["oclusal"] });
    expect(setDone(finding, 18, 0, true)).toBe(finding);
    const untreated = start({ layer: "plan", status: "obturado", surfaces: ["oclusal"] });
    expect(setDone(untreated, 18, 0, true)).toBe(untreated);
  });
});

describe("removeMark", () => {
  it("quita solo esa marca", () => {
    const value = start(
      { layer: "hallazgo", status: "caries", surfaces: ["oclusal"] },
      { layer: "plan", status: "endodoncia", surfaces: [], treatment: ENDO.slug },
    );
    expect(marks(removeMark(value, 18, 0))).toEqual([
      { layer: "plan", status: "endodoncia", surfaces: [], treatment: ENDO.slug },
    ]);
  });
});
