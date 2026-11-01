/**
 * Teléfonos con código de país (El Salvador y países cercanos).
 *
 * Se guardan ya formateados, p. ej. "+503 7000-1111". El backend tiene la
 * misma lista en backend/patients/phones.py: si se agrega un país,
 * agregarlo en los dos lados.
 */

export type PhoneCountry = {
  iso: string;
  name: string;
  code: string;
  lengths: number[];
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "SV", name: "El Salvador", code: "503", lengths: [8] },
  { iso: "GT", name: "Guatemala", code: "502", lengths: [8] },
  { iso: "HN", name: "Honduras", code: "504", lengths: [8] },
  { iso: "NI", name: "Nicaragua", code: "505", lengths: [8] },
  { iso: "CR", name: "Costa Rica", code: "506", lengths: [8] },
  { iso: "PA", name: "Panamá", code: "507", lengths: [7, 8] },
  { iso: "BZ", name: "Belice", code: "501", lengths: [7] },
  { iso: "MX", name: "México", code: "52", lengths: [10] },
  { iso: "US", name: "Estados Unidos", code: "1", lengths: [10] },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

export function phoneCountryByIso(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((country) => country.iso === iso) ?? DEFAULT_PHONE_COUNTRY;
}

export function maxPhoneDigits(country: PhoneCountry): number {
  return Math.max(...country.lengths);
}

/** País y dígitos propios del número. Sin "+" se asume El Salvador (datos viejos). */
export function parsePhone(value: string): { country: PhoneCountry; digits: string } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+")) {
    return { country: DEFAULT_PHONE_COUNTRY, digits };
  }
  // Los códigos de la lista no son prefijo uno de otro.
  const country = PHONE_COUNTRIES.find((item) => digits.startsWith(item.code));
  if (!country) {
    return null;
  }
  return { country, digits: digits.slice(country.code.length) };
}

/** Formato del número propio, también a medio escribir. */
export function formatNationalPhone(country: PhoneCountry, digits: string): string {
  if (country.iso === "US") {
    if (digits.length <= 3) {
      return digits;
    }
    const rest = digits.slice(6);
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}${rest ? `-${rest}` : ""}`;
  }
  if (country.iso === "MX") {
    return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6)]
      .filter(Boolean)
      .join(" ");
  }
  const split = digits.length === 7 && country.lengths.includes(7) ? 3 : 4;
  if (digits.length <= split) {
    return digits;
  }
  return `${digits.slice(0, split)}-${digits.slice(split)}`;
}

export function buildPhone(country: PhoneCountry, digits: string): string {
  if (!digits) {
    return "";
  }
  return `+${country.code} ${formatNationalPhone(country, digits)}`;
}

export function isValidPhone(value: string): boolean {
  const parsed = parsePhone(value);
  return parsed !== null && parsed.country.lengths.includes(parsed.digits.length);
}

/**
 * Lo escrito en el campo del número → teléfono completo. Por costumbre
 * escriben o pegan el código ("+503 7000-1111", "50370001111"): un número
 * completo con "+" cambia el país, y el código del país elegido se quita
 * cuando sobran dígitos.
 */
export function typedPhone(raw: string, country: PhoneCountry): string {
  const pasted = raw.trim().startsWith("+") ? parsePhone(raw) : null;
  if (pasted && pasted.country.lengths.includes(pasted.digits.length)) {
    return buildPhone(pasted.country, pasted.digits);
  }
  let digits = raw.replace(/\D/g, "");
  if (digits.length > maxPhoneDigits(country) && digits.startsWith(country.code)) {
    digits = digits.slice(country.code.length);
  }
  return buildPhone(country, digits.slice(0, maxPhoneDigits(country)));
}

/** Para enlaces tel: sin espacios ni guiones. */
export function phoneHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}
