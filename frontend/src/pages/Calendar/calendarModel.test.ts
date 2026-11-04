import { describe, expect, it } from "vitest";

import type { Appointment } from "../../services/appointments";
import {
  appointmentKind,
  groupByStudent,
  rangeTitle,
  shiftAnchor,
  visibleRange,
} from "./calendarModel";

function appointment(overrides: Partial<Appointment>): Appointment {
  return {
    id: 1,
    assignment: 1,
    patient: { id: 1, name: "Ana López" },
    student: { id: 5, name: "María Pérez" },
    starts_at: new Date(2026, 10, 3, 8, 0).toISOString(),
    ends_at: new Date(2026, 10, 3, 9, 0).toISOString(),
    duration_minutes: 60,
    status: "programada",
    notes: "",
    ...overrides,
  };
}

// Martes 3 de noviembre de 2026, 10:30.
const NOW = new Date(2026, 10, 3, 10, 30);

describe("appointmentKind", () => {
  it("una programada cuya hora ya pasó queda sin registrar", () => {
    expect(appointmentKind(appointment({}), NOW)).toBe("pendiente");
  });

  it("una programada en curso o futura sigue programada", () => {
    const enCurso = appointment({
      starts_at: new Date(2026, 10, 3, 10, 0).toISOString(),
      ends_at: new Date(2026, 10, 3, 11, 0).toISOString(),
    });
    expect(appointmentKind(enCurso, NOW)).toBe("programada");
  });

  it("atendidas y canceladas conservan su estado", () => {
    expect(appointmentKind(appointment({ status: "atendida" }), NOW)).toBe("atendida");
    expect(appointmentKind(appointment({ status: "cancelada" }), NOW)).toBe("cancelada");
  });
});

describe("visibleRange", () => {
  it("la semana va de lunes a sábado y pide la semana completa", () => {
    const range = visibleRange("semana", NOW, false);
    expect(range.days.map((day) => day.getDate())).toEqual([2, 3, 4, 5, 6, 7]);
    expect(range.start).toEqual(new Date(2026, 10, 2));
    expect(range.end).toEqual(new Date(2026, 10, 9));
  });

  it("con domingo muestra siete días", () => {
    expect(visibleRange("semana", NOW, true).days).toHaveLength(7);
  });

  it("el mes pide las seis semanas que dibuja FullCalendar", () => {
    const range = visibleRange("mes", NOW, false);
    expect(range.start).toEqual(new Date(2026, 9, 26));
    expect(range.end).toEqual(new Date(2026, 11, 7));
  });

  it("el día es solo ese día", () => {
    const range = visibleRange("dia", NOW, false);
    expect(range.start).toEqual(new Date(2026, 10, 3));
    expect(range.end).toEqual(new Date(2026, 10, 4));
  });
});

describe("shiftAnchor y rangeTitle", () => {
  it("avanza por día, semana o mes", () => {
    expect(shiftAnchor("dia", NOW, 1).getDate()).toBe(4);
    expect(shiftAnchor("semana", NOW, -1).getDate()).toBe(27);
    expect(shiftAnchor("mes", NOW, 1)).toEqual(new Date(2026, 11, 1));
  });

  it("titula cada vista en español", () => {
    expect(rangeTitle("semana", NOW, visibleRange("semana", NOW, false))).toBe("2 – 7 nov 2026");
    expect(rangeTitle("mes", NOW, visibleRange("mes", NOW, false))).toBe("Noviembre 2026");
    expect(rangeTitle("dia", NOW, visibleRange("dia", NOW, false))).toBe("Martes 3 de noviembre");
  });

  it("una semana entre dos meses nombra ambos", () => {
    const anchor = new Date(2026, 10, 30);
    expect(rangeTitle("semana", anchor, visibleRange("semana", anchor, false))).toBe(
      "30 nov – 5 dic 2026",
    );
  });
});

describe("groupByStudent", () => {
  it("agrupa por estudiante, ordena por nombre y por hora", () => {
    const rows = groupByStudent([
      appointment({ id: 1, student: { id: 9, name: "Zoe" }, starts_at: "2026-11-03T15:00:00Z" }),
      appointment({ id: 2, student: { id: 5, name: "Ana" }, starts_at: "2026-11-03T16:00:00Z" }),
      appointment({ id: 3, student: { id: 5, name: "Ana" }, starts_at: "2026-11-03T14:00:00Z" }),
    ]);
    expect(rows.map((row) => row.student.name)).toEqual(["Ana", "Zoe"]);
    expect(rows[0].appointments.map((item) => item.id)).toEqual([3, 2]);
  });
});
