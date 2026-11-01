import { describe, expect, it } from "vitest";

import type { ClinicalAreaRecord } from "../../services/catalogs";
import { treatmentInArea, treatmentOptions } from "./practiceFilters";

const treatment = (slug: string, name: string, is_active = true) => ({
  id: slug.length,
  slug,
  name,
  is_active,
  sort_order: 0,
});

const areas: ClinicalAreaRecord[] = [
  {
    id: 1,
    slug: "endodoncia",
    name: "Endodoncia",
    is_active: true,
    sort_order: 0,
    treatments: [
      treatment("endodoncia_monorradicular", "Endodoncia monorradicular"),
      treatment("vieja", "Inactiva", false),
    ],
  },
  {
    id: 2,
    slug: "operatoria",
    name: "Operatoria",
    is_active: true,
    sort_order: 1,
    treatments: [treatment("ameloplastia_adulto", "Ameloplastia adulto")],
  },
];

describe("filtro de tratamiento del directorio", () => {
  it("sin área lista todos los activos con su área", () => {
    expect(treatmentOptions(areas).map((option) => option.label)).toEqual([
      "Todos los tratamientos",
      "Endodoncia · Endodoncia monorradicular",
      "Operatoria · Ameloplastia adulto",
    ]);
  });

  it("con un área solo lista los de esa área", () => {
    expect(treatmentOptions(areas, "operatoria").map((option) => option.label)).toEqual([
      "Todos los tratamientos",
      "Ameloplastia adulto",
    ]);
  });

  it("sabe si un tratamiento es del área elegida", () => {
    expect(treatmentInArea(areas, "ameloplastia_adulto", "operatoria")).toBe(true);
    expect(treatmentInArea(areas, "ameloplastia_adulto", "endodoncia")).toBe(false);
    expect(treatmentInArea(areas, "ameloplastia_adulto")).toBe(true);
  });
});
