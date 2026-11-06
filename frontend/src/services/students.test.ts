import { describe, expect, it } from "vitest";

import { toStudent } from "./students";

// El endpoint responde distinto según el rol de quien pregunta; los dos
// formatos tienen que terminar igual en la pantalla.
describe("toStudent", () => {
  it("usa `name` de la vista reducida (docente, recepción)", () => {
    expect(
      toStudent({ id: 8, name: "Lucia Zepeda", email: "luciazd@fouees.edu.sv" }),
    ).toEqual({ id: 8, name: "Lucia Zepeda", email: "luciazd@fouees.edu.sv", username: null });
  });

  it("arma el nombre desde el formato completo (admin)", () => {
    expect(
      toStudent({
        id: 8,
        username: "luciazd",
        email: "luciazd@fouees.edu.sv",
        first_name: "Lucia",
        last_name: "Zepeda",
      }),
    ).toEqual({ id: 8, name: "Lucia Zepeda", email: "luciazd@fouees.edu.sv", username: "luciazd" });
  });

  it("cae al usuario si la cuenta no tiene nombre cargado", () => {
    expect(
      toStudent({ id: 11, username: "luisgm", email: "", first_name: "", last_name: "" }).name,
    ).toBe("luisgm");
  });
});
