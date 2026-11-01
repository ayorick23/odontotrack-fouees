import { describe, expect, it } from "vitest";

import {
  buildPhone,
  formatNationalPhone,
  isValidPhone,
  parsePhone,
  phoneCountryByIso,
  phoneHref,
  typedPhone,
} from "./phones";

describe("teléfonos con código de país", () => {
  it("arma el número con el formato de cada país", () => {
    expect(buildPhone(phoneCountryByIso("SV"), "70001111")).toBe("+503 7000-1111");
    expect(buildPhone(phoneCountryByIso("PA"), "3001111")).toBe("+507 300-1111");
    expect(buildPhone(phoneCountryByIso("MX"), "5512345678")).toBe("+52 55 1234 5678");
    expect(buildPhone(phoneCountryByIso("US"), "5551234567")).toBe("+1 (555) 123-4567");
    expect(buildPhone(phoneCountryByIso("SV"), "")).toBe("");
  });

  it("formatea mientras se escribe", () => {
    expect(formatNationalPhone(phoneCountryByIso("SV"), "700")).toBe("700");
    expect(formatNationalPhone(phoneCountryByIso("SV"), "70001")).toBe("7000-1");
    expect(formatNationalPhone(phoneCountryByIso("US"), "5551")).toBe("(555) 1");
  });

  it("lee el país del código y asume El Salvador sin código", () => {
    expect(parsePhone("+1 (555) 123-4567")).toMatchObject({ digits: "5551234567" });
    expect(parsePhone("+1 (555) 123-4567")?.country.iso).toBe("US");
    expect(parsePhone("7000-1111")?.country.iso).toBe("SV");
    expect(parsePhone("+34 612345678")).toBeNull();
    expect(parsePhone("")).toBeNull();
  });

  it("valida la cantidad de dígitos del país", () => {
    expect(isValidPhone("+503 7000-1111")).toBe(true);
    expect(isValidPhone("+503 7000-111")).toBe(false);
    expect(isValidPhone("+501 600-1111")).toBe(true);
    expect(isValidPhone("+34 612345678")).toBe(false);
  });

  it("quita el código del país cuando lo escriben dentro del número", () => {
    const sv = phoneCountryByIso("SV");
    expect(typedPhone("+503abc70001111", sv)).toBe("+503 7000-1111");
    expect(typedPhone("50370001111", sv)).toBe("+503 7000-1111");
    expect(typedPhone("7000-1111", sv)).toBe("+503 7000-1111");
  });

  it("al pegar un número completo con + cambia el país", () => {
    expect(typedPhone("+1 555 123 4567", phoneCountryByIso("SV"))).toBe("+1 (555) 123-4567");
  });

  it("deja el enlace tel: sin espacios ni símbolos", () => {
    expect(phoneHref("+1 (555) 123-4567")).toBe("tel:+15551234567");
  });
});
