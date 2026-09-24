import { describe, expect, it } from "vitest";

import { formatPlanChange, formatPlanValue } from "./OdontogramPlanDiff";

describe("formatPlanValue", () => {
  it("traduce el póntico y oculta la clave de material", () => {
    expect(formatPlanValue("Pontic - restoration.material.none")).toBe("Puente");
    expect(formatPlanValue("Póntico – restoration.material.nonee")).toBe("Puente");
    expect(formatPlanValue("—")).toBe("Sin marca");
    expect(formatPlanValue("none")).toBe("Sin marca");
  });
});

describe("formatPlanChange", () => {
  it("muestra el cambio del diente 13 en español", () => {
    expect(
      formatPlanChange({
        toothNo: 13,
        axis: "restoration",
        from: "—",
        to: "Pontic - restoration.material.none",
      }),
    ).toBe("13 Puente");
    expect(
      formatPlanChange({
        toothNo: 16,
        axis: "restoration",
        from: "Implant",
        to: "permanent tooth",
      }),
    ).toBe("16 Implante → Sano");
  });
});
