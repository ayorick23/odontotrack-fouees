import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EngineOptGroup, EngineOption } from "./engine";

const EMPTY = "__empty__";

const triggerClass =
  "h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-none outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800";

const menuClass =
  "z-[80] max-h-72 rounded-xl border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const itemClass =
  "rounded-lg text-sm focus:bg-teal-50 focus:text-teal-900 dark:focus:bg-teal-950 dark:focus:text-teal-100";

type OdontogramFieldSelectProps = {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  options?: EngineOption[];
  groups?: EngineOptGroup[];
  onChange: (value: string) => void;
};

export function OdontogramFieldSelect({
  label,
  value,
  disabled = false,
  placeholder,
  options = [],
  groups = [],
  onChange,
}: OdontogramFieldSelectProps) {
  const selectValue = value === "" ? EMPTY : value;

  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <Select
        value={selectValue}
        onValueChange={(next) => onChange(next === EMPTY ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger className={triggerClass}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" align="start" className={menuClass}>
          {placeholder ? (
            <SelectItem className={itemClass} value={EMPTY}>
              {placeholder}
            </SelectItem>
          ) : null}
          {options.map((option) => (
            <SelectItem
              key={option.value || option.label}
              className={itemClass}
              value={option.value || EMPTY}
            >
              {option.label}
            </SelectItem>
          ))}
          {groups
            .filter((group) => group.options.length > 0)
            .map((group) => (
            <SelectGroup key={group.label}>
              {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
              {group.options.map((option) => (
                <SelectItem
                  key={option.value || `${group.label}-empty`}
                  className={itemClass}
                  value={option.value || EMPTY}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
