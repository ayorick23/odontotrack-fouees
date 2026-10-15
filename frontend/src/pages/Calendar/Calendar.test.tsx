import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));

// FullCalendar necesita medidas reales del navegador; aquí basta un reemplazo.
vi.mock("@fullcalendar/react", () => ({
  default: () => <div data-testid="calendario" />,
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, username: "usuario", permissions: auth.permissions },
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

describe("Calendario de citas", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
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
