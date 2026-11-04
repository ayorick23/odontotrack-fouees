import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Appointment } from "../../services/appointments";
import { AppointmentDetailModal } from "./AppointmentDetailModal";
import { Calendar } from "./Calendar";
import { NewAppointmentModal } from "./NewAppointmentModal";

const api = vi.hoisted(() => ({
  listAppointments: vi.fn(),
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  setAppointmentStatus: vi.fn(),
  listSchedulableAssignments: vi.fn(),
}));

const auth = vi.hoisted(() => ({ permissions: [] as string[], role: "recepcion" }));

// FullCalendar necesita medidas reales del navegador; aquí basta un reemplazo.
vi.mock("@fullcalendar/react", () => ({
  default: () => <div data-testid="calendario" />,
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, username: "usuario", role: auth.role, permissions: auth.permissions },
  }),
}));

vi.mock("../../services/appointments", async () => {
  const actual = await vi.importActual<typeof import("../../services/appointments")>(
    "../../services/appointments",
  );
  return { ...actual, ...api };
});

const appointment: Appointment = {
  id: 7,
  assignment: 3,
  patient: { id: 4, name: "Ana López" },
  student: { id: 5, name: "María Pérez" },
  starts_at: "2026-10-01T16:00:00Z",
  ends_at: "2026-10-01T17:00:00Z",
  duration_minutes: 60,
  status: "programada",
  notes: "",
};

/** Cita de la semana del martes 3 nov 2026 (la "hoy" de los tests). */
function weekAppointment(
  id: number,
  student: Appointment["student"],
  day: number,
  hour: number,
  status: Appointment["status"],
): Appointment {
  return {
    ...appointment,
    id,
    patient: { id: 100 + id, name: `Paciente ${id}` },
    student,
    starts_at: new Date(2026, 10, day, hour).toISOString(),
    ends_at: new Date(2026, 10, day, hour + 1).toISOString(),
    status,
  };
}

const maria = { id: 5, name: "María Pérez" };
const luis = { id: 6, name: "Luis Gómez" };

describe("Calendario de citas", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listAppointments.mockResolvedValue([]);
    auth.role = "recepcion";
    // Solo Date: los temporizadores reales siguen (userEvent los usa).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 3, 10, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pide las citas de la semana visible y las cuenta por estado", async () => {
    api.listAppointments.mockResolvedValue([
      // Lunes 8:00 programada: ya pasó → sin registrar.
      weekAppointment(1, maria, 2, 8, "programada"),
      weekAppointment(2, maria, 2, 9, "atendida"),
      weekAppointment(3, luis, 5, 9, "programada"),
      weekAppointment(4, luis, 6, 9, "cancelada"),
    ]);
    auth.permissions = ["calendar.view"];
    render(<Calendar />);

    await waitFor(() =>
      expect(api.listAppointments).toHaveBeenCalledWith({
        start: new Date(2026, 10, 2).toISOString(),
        end: new Date(2026, 10, 9).toISOString(),
      }),
    );
    const states = screen.getByRole("group", { name: "Mostrar estados" });
    expect(await within(states).findByText("4 citas esta semana")).toBeInTheDocument();
    expect(within(states).getByRole("button", { name: /Programada/ })).toHaveTextContent("1");
    expect(within(states).getByRole("button", { name: /Sin registrar/ })).toHaveTextContent("1");
    expect(within(states).getByRole("button", { name: /Atendida/ })).toHaveTextContent("1");
    expect(within(states).getByRole("button", { name: /Cancelada/ })).toHaveTextContent("1");
  });

  it("la vista por estudiante agrupa sus citas y oculta los estados apagados", async () => {
    api.listAppointments.mockResolvedValue([
      weekAppointment(1, maria, 2, 8, "programada"),
      weekAppointment(2, maria, 3, 9, "atendida"),
      weekAppointment(3, luis, 5, 9, "programada"),
    ]);
    auth.permissions = ["calendar.view"];
    const user = userEvent.setup();
    render(<Calendar />);

    await user.click(screen.getByRole("button", { name: "Por estudiante" }));
    const table = await screen.findByRole("table", { name: "Citas por estudiante" });
    const rows = within(table).getAllByRole("rowheader");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Luis Gómez"),
      expect.stringContaining("María Pérez"),
    ]);
    expect(rows[1]).toHaveTextContent("1 sin registrar");
    expect(within(table).getByText("Paciente 2")).toBeInTheDocument();

    const states = screen.getByRole("group", { name: "Mostrar estados" });
    await user.click(within(states).getByRole("button", { name: /Atendida/ }));
    expect(within(table).queryByText("Paciente 2")).not.toBeInTheDocument();
  });

  it("el estudiante no ve la vista por estudiante ni el filtro", async () => {
    auth.role = "estudiante";
    auth.permissions = ["calendar.view"];
    render(<Calendar />);
    await waitFor(() => expect(api.listAppointments).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Por estudiante" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Filtrar por estudiante" })).toBeNull();
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true");
  });

  it("el detalle de una cita sin registrar pregunta si el paciente vino", () => {
    render(
      <AppointmentDetailModal
        appointment={appointment}
        canEdit
        pending
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(/¿El paciente asistió\?/)).toBeInTheDocument();
    expect(screen.getByText("Sin registrar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar atendida" })).toBeInTheDocument();
  });

  it("solo muestra Nueva cita con el permiso para agendar", () => {
    auth.permissions = ["calendar.view"];
    const { unmount } = render(<Calendar />);
    expect(screen.queryByRole("button", { name: /Nueva cita/ })).toBeNull();
    unmount();

    auth.permissions = ["calendar.view", "calendar.create"];
    render(<Calendar />);
    expect(screen.getByRole("button", { name: /Nueva cita/ })).toBeInTheDocument();
  });

  it("agenda una cita para un caso activo", async () => {
    api.listSchedulableAssignments.mockResolvedValue([
      { id: 3, patient: "Ana López", student: "María Pérez" },
    ]);
    api.createAppointment.mockResolvedValue(appointment);
    const onCreated = vi.fn();
    const start = new Date(2026, 9, 1, 10, 30);
    const user = userEvent.setup();
    render(<NewAppointmentModal start={start} onClose={vi.fn()} onCreated={onCreated} />);

    expect(screen.getByRole("button", { name: "Agendar" })).toBeDisabled();
    await user.type(screen.getByRole("combobox", { name: "Paciente" }), "ana");
    await user.click(await screen.findByRole("option", { name: /Ana López/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Duración" }), "90");
    await user.click(screen.getByRole("button", { name: "Agendar" }));

    await waitFor(() => {
      expect(api.createAppointment).toHaveBeenCalledWith({
        assignment: 3,
        starts_at: start.toISOString(),
        duration_minutes: 90,
        notes: "",
      });
    });
    expect(onCreated).toHaveBeenCalled();
  });

  it("cancelar una cita pide confirmación", async () => {
    api.setAppointmentStatus.mockResolvedValue({ ...appointment, status: "cancelada" });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <AppointmentDetailModal
        appointment={appointment}
        canEdit
        onClose={vi.fn()}
        onChanged={onChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancelar cita" }));
    expect(api.setAppointmentStatus).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sí, cancelar" }));

    await waitFor(() => {
      expect(api.setAppointmentStatus).toHaveBeenCalledWith(7, "cancelada");
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it("sin permiso para editar, el detalle es solo de lectura", () => {
    render(
      <AppointmentDetailModal
        appointment={appointment}
        canEdit={false}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("María Pérez")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reprogramar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar atendida" })).toBeNull();
  });
});
