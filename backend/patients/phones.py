"""Teléfonos con código de país (El Salvador y países cercanos).

Se guardan ya formateados en el mismo campo de texto, p. ej.
"+503 7000-1111". El frontend tiene la misma lista en src/lib/phones.ts:
si se agrega un país, agregarlo en los dos lados.
"""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class PhoneCountry:
    iso: str
    name: str
    code: str
    lengths: tuple[int, ...]


COUNTRIES: tuple[PhoneCountry, ...] = (
    PhoneCountry("SV", "El Salvador", "503", (8,)),
    PhoneCountry("GT", "Guatemala", "502", (8,)),
    PhoneCountry("HN", "Honduras", "504", (8,)),
    PhoneCountry("NI", "Nicaragua", "505", (8,)),
    PhoneCountry("CR", "Costa Rica", "506", (8,)),
    PhoneCountry("PA", "Panamá", "507", (7, 8)),
    PhoneCountry("BZ", "Belice", "501", (7,)),
    PhoneCountry("MX", "México", "52", (10,)),
    PhoneCountry("US", "Estados Unidos", "1", (10,)),
)
DEFAULT_COUNTRY = COUNTRIES[0]

# Solo dígitos, espacios, guiones, paréntesis y un "+" inicial.
ALLOWED_CHARACTERS = re.compile(r"^\+?[\d\s()-]+$")


def format_national(country: PhoneCountry, digits: str) -> str:
    if country.iso == "US":
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    if country.iso == "MX":
        return f"{digits[:2]} {digits[2:6]} {digits[6:]}"
    split = 4 if len(digits) == 8 else 3
    return f"{digits[:split]}-{digits[split:]}"


def normalize_phone(value: str) -> str | None:
    """'+503 70001111', '7000-1111' (El Salvador por defecto) → '+503 7000-1111'.

    None si tiene letras u otros símbolos, el código de país no está en la
    lista o la cantidad de dígitos no corresponde al país.
    """
    value = value.strip()
    if not ALLOWED_CHARACTERS.match(value):
        return None
    digits = re.sub(r"\D", "", value)
    if value.startswith("+"):
        # Los códigos de la lista no son prefijo uno de otro.
        country = next((c for c in COUNTRIES if digits.startswith(c.code)), None)
        if country is None:
            return None
        digits = digits[len(country.code):]
    else:
        country = DEFAULT_COUNTRY
    if len(digits) not in country.lengths:
        return None
    return f"+{country.code} {format_national(country, digits)}"
