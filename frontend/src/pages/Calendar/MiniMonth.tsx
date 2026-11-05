import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

import { ChevronLeft, ChevronRight } from "../../components/icons";
import { dayKey } from "./calendarModel";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Mes pequeño de la columna lateral: hoy en lima, el rango visible
 * resaltado, un punto en los días con citas y clic para ir a un día.
 * Se monta con `key` = mes del ancla, así al navegar en el calendario
 * principal el mes chico se pone al día sin efectos.
 */
export function MiniMonth({
  anchor,
  now,
  rangeStart,
  rangeEnd,
  marked,
  onPick,
}: {
  anchor: Date;
  now: Date;
  rangeStart: Date;
  /** Exclusivo (como el rango del calendario). */
  rangeEnd: Date;
  marked: ReadonlySet<string>;
  onPick: (day: Date) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(anchor));
  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const label = format(month, "MMMM yyyy", { locale: es });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="pl-1 text-sm font-semibold capitalize text-ink dark:text-white">{label}</p>
        <div className="flex">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setMonth((current) => addMonths(current, -1))}
            className="press grid size-7 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            className="press grid size-7 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`} className="pb-1 text-[10.5px] font-semibold text-slate-400">
            {day}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const today = isSameDay(day, now);
          const inRange = day >= rangeStart && day < rangeEnd;
          const hasAppointments = marked.has(dayKey(day));
          return (
            <button
              key={dayKey(day)}
              type="button"
              onClick={() => onPick(day)}
              aria-label={format(day, "EEEE d 'de' MMMM", { locale: es })}
              aria-current={today ? "date" : undefined}
              className={`press num relative mx-auto grid size-8 place-items-center rounded-full text-[12.5px] transition ${
                today
                  ? "bg-lime font-bold text-ink"
                  : inRange
                    ? "bg-lime-soft font-semibold text-ink dark:text-white"
                    : inMonth
                      ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                      : "text-slate-300 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-white/10"
              }`}
            >
              {format(day, "d")}
              {hasAppointments ? (
                <span
                  className={`absolute bottom-1 size-1 rounded-full ${today ? "bg-ink" : "bg-ink/60 dark:bg-lime"}`}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
