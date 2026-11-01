import { useState, type Ref } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  buildPhone,
  formatNationalPhone,
  maxPhoneDigits,
  parsePhone,
  phoneCountryByIso,
  typedPhone,
} from "../lib/phones";
import { cn } from "../lib/utils";

type PhoneInputProps = {
  /** Teléfono completo, p. ej. "+503 7000-1111", o "" si está vacío. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  disabled?: boolean;
  autoComplete?: string;
  inputClassName?: string;
  selectClassName?: string;
  menuClassName?: string;
};

/** Código de país + número propio, solo dígitos y con el formato del país. */
export function PhoneInput({
  value,
  onChange,
  onBlur,
  name,
  inputRef,
  label,
  disabled,
  autoComplete = "off",
  inputClassName,
  selectClassName,
  menuClassName,
}: PhoneInputProps) {
  // El país sale del número; mientras está vacío, del último elegido.
  const [emptyCountryIso, setEmptyCountryIso] = useState(DEFAULT_PHONE_COUNTRY.iso);
  const parsed = parsePhone(value);
  const country = parsed?.country ?? phoneCountryByIso(emptyCountryIso);
  const digits = parsed?.digits ?? "";

  return (
    <div className="flex gap-2">
      <Select
        value={country.iso}
        onValueChange={(iso) => {
          const next = phoneCountryByIso(iso);
          setEmptyCountryIso(iso);
          onChange(buildPhone(next, digits.slice(0, maxPhoneDigits(next))));
        }}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={`Código de país de ${label.toLowerCase()}`}
          className={cn(selectClassName, "w-28 shrink-0")}
        >
          <SelectValue>{`${country.iso} +${country.code}`}</SelectValue>
        </SelectTrigger>
        <SelectContent className={menuClassName}>
          {PHONE_COUNTRIES.map((item) => (
            <SelectItem key={item.iso} value={item.iso}>
              {item.name} +{item.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        type="tel"
        inputMode="numeric"
        aria-label={label}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder={formatNationalPhone(country, "7".repeat(maxPhoneDigits(country)))}
        className={cn(inputClassName, "min-w-0 flex-1")}
        name={name}
        ref={inputRef}
        value={formatNationalPhone(country, digits)}
        onBlur={onBlur}
        onChange={(event) => onChange(typedPhone(event.target.value, country))}
      />
    </div>
  );
}
