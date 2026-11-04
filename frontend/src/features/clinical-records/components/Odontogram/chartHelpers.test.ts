import { describe, expect, it } from "vitest";

import { emptyOdontogram, updateTooth, type OdontogramValue } from "../../types";
import { changedTeethCount } from "./changes";
import { applyToothLabelStates, toothLabelStates } from "./toothLabels";
import { neighborTooth, toothName } from "./toothNames";

function withMarks(value: OdontogramValue, fdi: 16 | 27 | 36, marks: OdontogramValue["teeth"][number]["marks"]) {
  return updateTooth(value, fdi, { marks });
}

describe("toothName", () => {
  it("nombra permanentes y temporales", () => {
    expect(toothName(27)).toBe("Segundo molar superior izquierdo");
    expect(toothName(41)).toBe("Incisivo central inferior derecho");
    expect(toothName(65)).toBe("Segundo molar temporal superior izquierdo");
  });
});

describe("neighborTooth", () => {
  it("sigue el orden de la carta y da la vuelta", () => {
    expect(neighborTooth(11, 1)).toBe(21);
    expect(neighborTooth(28, 1)).toBe(48);
    expect(neighborTooth(38, 1)).toBe(18);
    expect(neighborTooth(18, -1)).toBe(38);
  });

  it("las temporales navegan entre temporales", () => {
    expect(neighborTooth(51, 1)).toBe(61);
    expect(neighborTooth(75, 1)).toBe(55);
  });
});

describe("toothLabelStates", () => {
  const value = withMarks(
    withMarks(
      withMarks(emptyOdontogram(), 16, [
        { layer: "hallazgo", status: "caries", surfaces: ["oclusal"] },
      ]),
      27,
      [{ layer: "plan", status: null, surfaces: [], treatment: "profilaxis" }],
    ),
    36,
    [{ layer: "hecho", status: "obturado", surfaces: ["oclusal"], treatment: "resina" }],
  );

  it("en diagnóstico marca solo lo que trae el paciente", () => {
    const states = toothLabelStates(value, "diagnostico");
    expect(states.get(16)).toBe("finding");
    expect(states.has(27)).toBe(false);
    expect(states.has(36)).toBe(false);
  });

  it("en el plan distingue pendiente de realizado", () => {
    const states = toothLabelStates(value, "plan");
    expect(states.get(27)).toBe("plan");
    expect(states.get(36)).toBe("done");
    expect(states.has(16)).toBe(false);
  });

  it("pone y quita data-state en los números de la librería", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<div class="tooth-label-cell">16</div><div class="tooth-label-cell" data-state="plan">27</div>';
    applyToothLabelStates(root, toothLabelStates(value, "diagnostico"));
    const [cell16, cell27] = root.querySelectorAll<HTMLElement>(".tooth-label-cell");
    expect(cell16.dataset.state).toBe("finding");
    expect(cell27.dataset.state).toBeUndefined();
  });
});

describe("changedTeethCount", () => {
  const saved = withMarks(emptyOdontogram(), 27, [
    { layer: "plan", status: null, surfaces: [], treatment: "profilaxis" },
  ]);

  it("sin cambios es cero", () => {
    expect(changedTeethCount(saved, saved)).toBe(0);
  });

  it("marcar realizado cuenta como un solo cambio", () => {
    const done = withMarks(saved, 27, [
      { layer: "hecho", status: null, surfaces: [], treatment: "profilaxis" },
    ]);
    expect(changedTeethCount(saved, done)).toBe(1);
  });

  it("ignora el autor y la fecha que pone el servidor", () => {
    const stamped = withMarks(saved, 27, [
      {
        layer: "plan",
        status: null,
        surfaces: [],
        treatment: "profilaxis",
        doneBy: 3,
        doneByName: "Lucía Zepeda",
        doneAt: "2026-11-03",
      },
    ]);
    expect(changedTeethCount(saved, stamped)).toBe(0);
  });

  it("cuenta cada pieza que cambia", () => {
    const next = withMarks(
      withMarks(saved, 16, [{ layer: "hallazgo", status: "caries", surfaces: ["oclusal"] }]),
      36,
      [{ layer: "hallazgo", status: "obturado", surfaces: ["oclusal"] }],
    );
    expect(changedTeethCount(saved, next)).toBe(2);
  });
});
