import { describe, expect, it } from "vitest";

import { emptyOdontogram } from "../../types";
import { chartToDomain, domainKey, domainToChart, engineToothToFinding } from "./mapEngineState";

describe("engineToothToFinding", () => {
  it("marca extraído cuando el diente no está presente", () => {
    expect(
      engineToothToFinding(16, { toothSelection: "none" }),
    ).toEqual({
      fdi: 16,
      marks: [{ layer: "hecho", status: "extraido", surfaces: [] }],
      oralMarks: { placa: false, sangrado: false, sarro: false },
      practice: { indicated: false, clinicalArea: null },
    });
  });

  it("separa caries y obturado con sus propias superficies", () => {
    expect(
      engineToothToFinding(21, { toothSelection: "implant" }).marks,
    ).toEqual([{ layer: "hecho", status: "implante", surfaces: [] }]);
    expect(
      engineToothToFinding(11, {
        toothSelection: "tooth-base",
        restorationType: "crown",
        caries: ["caries-occlusal"],
      }),
    ).toEqual({
      fdi: 11,
      marks: [
        { layer: "hecho", status: "corona", surfaces: [] },
        { layer: "hallazgo", status: "caries", surfaces: ["oclusal"] },
      ],
      oralMarks: { placa: false, sangrado: false, sarro: false },
      practice: { indicated: false, clinicalArea: null },
    });
    expect(
      engineToothToFinding(36, {
        toothSelection: "tooth-base",
        caries: ["caries-occlusal", "caries-buccal"],
        fillingSurfaces: ["occlusal"],
      }),
    ).toEqual({
      fdi: 36,
      marks: [
        { layer: "hallazgo", status: "caries", surfaces: ["oclusal", "vestibular"] },
        { layer: "hecho", status: "obturado", surfaces: ["oclusal"] },
      ],
      oralMarks: { placa: false, sangrado: false, sarro: false },
      practice: { indicated: false, clinicalArea: null },
    });
  });
});

describe("chartToDomain", () => {
  it("rellena los 32 dientes FDI y deriva marcas generales", () => {
    const value = chartToDomain({
      version: 2.2,
      teeth: {
        "16": {
          toothSelection: "tooth-base",
          caries: ["caries-occlusal"],
          calculus: true,
          plaque: ["buccal"],
          perio: { bop: ["B"] },
        },
        "99": { toothSelection: "none" },
      },
    });

    expect(value.teeth).toHaveLength(32);
    expect(value.teeth.find((tooth) => tooth.fdi === 16)).toEqual({
      fdi: 16,
      marks: [{ layer: "hallazgo", status: "caries", surfaces: ["oclusal"] }],
      oralMarks: { placa: true, sangrado: true, sarro: true },
      practice: { indicated: false, clinicalArea: null },
    });
    expect(value.teeth.find((tooth) => tooth.fdi === 11)?.marks).toEqual([]);
    expect(value.oralMarks).toEqual({
      placa: true,
      sangrado: true,
      sarro: true,
    });
    expect(value.visualSnapshot?.teeth?.["16"]).toBeTruthy();
  });

  it("guarda el plan como capa distinta y conserva el hallazgo", () => {
    const previous = emptyOdontogram();
    const sixteen = previous.teeth.find((tooth) => tooth.fdi === 16);
    if (sixteen) {
      sixteen.marks = [
        { layer: "hallazgo", status: "caries", surfaces: ["mesial", "oclusal"] },
      ];
    }

    const value = chartToDomain(
      {
        version: 2.2,
        teeth: {
          "16": {
            toothSelection: "tooth-base",
            caries: ["caries-mesial", "caries-occlusal"],
          },
        },
        plan: {
          version: 2.2,
          teeth: {
            "16": {
              toothSelection: "tooth-base",
              fillingSurfaces: ["mesial", "occlusal"],
            },
          },
        },
      },
      { previous, activeLayer: "plan" },
    );

    expect(value.teeth.find((tooth) => tooth.fdi === 16)?.marks).toEqual([
      { layer: "hallazgo", status: "caries", surfaces: ["mesial", "oclusal"] },
      { layer: "plan", status: "obturado", surfaces: ["mesial", "oclusal"] },
    ]);
  });

  it("asigna a plan un puente nuevo marcado en esa capa", () => {
    const value = chartToDomain(
      {
        version: 2.2,
        teeth: {
          "13": { toothSelection: "tooth-base", restorationType: "bridge" },
        },
      },
      { previous: emptyOdontogram(), activeLayer: "plan" },
    );

    expect(value.teeth.find((tooth) => tooth.fdi === 13)?.marks).toEqual([
      { layer: "plan", status: "puente", surfaces: [] },
    ]);
  });
});

describe("domainToChart", () => {
  it("reconstruye un payload mínimo sin snapshot", () => {
    const value = emptyOdontogram();
    const sixteen = value.teeth.find((tooth) => tooth.fdi === 16);
    if (sixteen) {
      sixteen.marks = [
        { layer: "hallazgo", status: "caries", surfaces: ["oclusal"] },
      ];
    }
    value.oralMarks.sarro = true;

    const chart = domainToChart(value);
    const tooth = chart.teeth?.["16"] as Record<string, unknown>;

    expect(tooth.toothSelection).toBe("tooth-base");
    expect(tooth.caries).toEqual(["caries-occlusal"]);
    expect(tooth.calculus).toBe(true);
  });

  it("prefiere el snapshot visual si ya existe", () => {
    const snapshot = {
      version: 2.2,
      teeth: { "11": { toothSelection: "implant" } },
    };
    const chart = domainToChart({
      ...emptyOdontogram(),
      visualSnapshot: snapshot,
    });
    expect(chart).toBe(snapshot);
  });
});

describe("domainKey", () => {
  it("cambia cuando el snapshot visual incluye plan o perio", () => {
    const base = emptyOdontogram();
    const withPlan = {
      ...base,
      visualSnapshot: {
        version: 2.2,
        teeth: {},
        plan: { teeth: { "11": { toothSelection: "none" } } },
      },
    };
    expect(domainKey(base)).not.toBe(domainKey(withPlan));
  });
});
