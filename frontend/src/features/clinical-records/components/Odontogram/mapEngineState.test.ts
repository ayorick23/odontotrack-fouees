import { describe, expect, it } from "vitest";

import {
  emptyOdontogram,
  updateTooth,
  type OdontogramValue,
  type ToothMark,
} from "../../types";
import { domainKey, domainToChart, marksToEngineTooth } from "./mapEngineState";

function mark(partial: Partial<ToothMark> & Pick<ToothMark, "status">): ToothMark {
  return { layer: "hallazgo", surfaces: [], ...partial };
}

describe("marksToEngineTooth", () => {
  it("dibuja distinto cada estado que antes se confundía", () => {
    const drawn = (status: ToothMark["status"]) =>
      marksToEngineTooth([mark({ status })]);
    expect(drawn("extraido")).toEqual({ toothSelection: "no-tooth-after-extraction" });
    expect(drawn("ausente_congenito")).toEqual({ toothSelection: "none" });
    expect(drawn("no_erupcionado")).toEqual({ toothSelection: "tooth-under-gum" });
    expect(drawn("raiz_retenida")).toMatchObject({
      brokenMesial: true,
      brokenDistal: true,
      brokenIncisal: true,
    });
    expect(drawn("fractura")).toMatchObject({ brokenMesial: true });
    expect(drawn("fractura")).not.toHaveProperty("caries");
    expect(drawn("sellante")).toMatchObject({ fissureSealing: true });
    expect(drawn("sellante")).not.toHaveProperty("fillingSurfaces");
  });

  it("dibuja endodoncia y pulpotomía en el conducto", () => {
    expect(marksToEngineTooth([mark({ status: "endodoncia" })]).endo).toBe("endo-filling");
    expect(marksToEngineTooth([mark({ status: "pulpotomia" })]).endo).toBe(
      "endo-medical-filling",
    );
  });

  it("separa caries y obturado con sus superficies y material", () => {
    const tooth = marksToEngineTooth([
      mark({ status: "caries", surfaces: ["mesial"] }),
      mark({ status: "obturado", surfaces: ["oclusal"] }),
    ]);
    expect(tooth.caries).toEqual(["caries-mesial"]);
    expect(tooth.fillingSurfaces).toEqual(["occlusal"]);
    expect(tooth.fillingMaterial).toBe("composite");
    expect(
      marksToEngineTooth([mark({ status: "restauracion_temporal", surfaces: ["distal"] })])
        .fillingMaterial,
    ).toBe("temporary");
  });

  it("en el plan la exodoncia se ve como a extraer, no como ausente", () => {
    expect(
      marksToEngineTooth([mark({ layer: "plan", status: "extraido" })], { plan: true }),
    ).toEqual({ toothSelection: "tooth-base", extractionPlan: true });
  });

  it("un tratamiento sin dibujo deja el diente sano", () => {
    expect(
      marksToEngineTooth([
        mark({ layer: "plan", status: null, treatment: "diagnostico_con_rx_panoramica" }),
      ]),
    ).toEqual({ toothSelection: "tooth-base" });
  });
});

describe("domainToChart", () => {
  function withMarks(...marks: ToothMark[]): OdontogramValue {
    return updateTooth(emptyOdontogram(), 18, { marks });
  }

  it("deja el plan fuera de la carta del estado y lo suma en la del plan", () => {
    const chart = domainToChart(
      withMarks(
        mark({ status: "caries", surfaces: ["oclusal"] }),
        mark({ layer: "plan", status: "endodoncia", treatment: "endodoncia_monorradicular" }),
      ),
    );
    const status = chart.teeth?.["18"] as Record<string, unknown>;
    const plan = (chart.plan as { teeth: Record<string, Record<string, unknown>> }).teeth["18"];
    expect(status.endo).toBeUndefined();
    expect(status.caries).toEqual(["caries-occlusal"]);
    expect(plan.endo).toBe("endo-filling");
    expect(plan.caries).toEqual(["caries-occlusal"]);
  });

  it("conserva del snapshot lo que no son marcas y recalcula lo demás", () => {
    const value: OdontogramValue = {
      ...withMarks(mark({ status: "obturado", surfaces: ["mesial"] })),
      visualSnapshot: {
        version: 2.2,
        teeth: {
          "18": {
            // Viejo: el dibujo decía caries; las marcas dicen obturado.
            caries: ["caries-occlusal"],
            endo: "endo-filling",
            pulpDx: "necrosis",
            ortho: { appliance: "bracket" },
          },
          "17": { endo: "endo-resection" },
        },
      },
    };
    const tooth = domainToChart(value).teeth?.["18"] as Record<string, unknown>;
    expect(tooth.caries).toBeUndefined();
    expect(tooth.endo).toBeUndefined();
    expect(tooth.fillingSurfaces).toEqual(["mesial"]);
    expect(tooth.pulpDx).toBe("necrosis");
    expect(tooth.ortho).toEqual({ appliance: "bracket" });
    // Un estado pulpar elegido en la tarjeta de Endodoncia se respeta.
    expect((domainToChart(value).teeth?.["17"] as Record<string, unknown>).endo).toBe(
      "endo-resection",
    );
  });

  it("dibuja sarro y placa de la pieza", () => {
    const value = updateTooth(emptyOdontogram(), 21, {
      oralMarks: { placa: true, sangrado: false, sarro: true },
    });
    expect(domainToChart(value).teeth?.["21"]).toMatchObject({
      calculus: true,
      plaque: ["buccal"],
    });
  });
});

describe("domainKey", () => {
  it("cambia cuando el snapshot visual cambia", () => {
    const base = emptyOdontogram();
    expect(domainKey(base)).not.toBe(
      domainKey({ ...base, visualSnapshot: { teeth: { "18": { perio: {} } } } }),
    );
  });
});
