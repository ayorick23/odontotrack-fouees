import { describe, expect, it } from "vitest";

import { emptyOdontogram } from "../../types";
import { chartToDomain, domainKey, domainToChart, engineToothToFinding } from "./mapEngineState";

describe("engineToothToFinding", () => {
  it("marca extraído cuando el diente no está presente", () => {
    expect(
      engineToothToFinding(16, { toothSelection: "none" }),
    ).toEqual({
      fdi: 16,
      status: "extraido",
      statuses: ["extraido"],
      surfaces: [],
    });
  });

  it("combina corona, caries y obturado en el mismo diente", () => {
    expect(
      engineToothToFinding(21, { toothSelection: "implant" }).status,
    ).toBe("implante");
    expect(
      engineToothToFinding(11, {
        toothSelection: "tooth-base",
        restorationType: "crown",
        caries: ["caries-occlusal"],
      }),
    ).toEqual({
      fdi: 11,
      status: "corona",
      statuses: ["corona", "caries"],
      surfaces: ["oclusal"],
    });
    expect(
      engineToothToFinding(36, {
        toothSelection: "tooth-base",
        caries: ["caries-occlusal", "caries-buccal"],
        fillingSurfaces: ["occlusal"],
      }),
    ).toEqual({
      fdi: 36,
      status: "caries",
      statuses: ["caries", "obturado"],
      surfaces: ["oclusal", "vestibular"],
    });
    expect(
      engineToothToFinding(24, {
        toothSelection: "tooth-base",
        caries: ["occlusal"],
      }),
    ).toEqual({
      fdi: 24,
      status: "caries",
      statuses: ["caries"],
      surfaces: ["oclusal"],
    });
    expect(
      engineToothToFinding(46, {
        toothSelection: "tooth-base",
        fillingSurfaces: ["mesial", "distal"],
      }),
    ).toEqual({
      fdi: 46,
      status: "obturado",
      statuses: ["obturado"],
      surfaces: ["mesial", "distal"],
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
      status: "caries",
      statuses: ["caries"],
      surfaces: ["oclusal"],
    });
    expect(value.teeth.find((tooth) => tooth.fdi === 11)?.status).toBe("sano");
    expect(value.oralMarks).toEqual({
      placa: true,
      sangrado: true,
      sarro: true,
    });
    expect(value.visualSnapshot?.teeth?.["16"]).toBeTruthy();
  });

  it("conserva el plan de tratamiento en el snapshot", () => {
    const plan = { version: 2.2, teeth: { "11": { toothSelection: "none" } } };
    const value = chartToDomain({
      version: 2.2,
      teeth: {},
      plan,
    });
    expect(value.visualSnapshot?.plan).toEqual(plan);
  });
});

describe("domainToChart", () => {
  it("reconstruye un payload mínimo sin snapshot", () => {
    const value = emptyOdontogram();
    const sixteen = value.teeth.find((tooth) => tooth.fdi === 16);
    if (sixteen) {
      sixteen.status = "caries";
      sixteen.surfaces = ["oclusal"];
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
