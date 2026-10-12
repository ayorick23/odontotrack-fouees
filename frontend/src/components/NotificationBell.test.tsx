import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import type { AppNotification } from "../services/notifications";
import { Navbar } from "./Navbar";
import { NotificationBell } from "./NotificationBell";

const api = vi.hoisted(() => ({
  getUnreadCount: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock("../services/notifications", () => api);

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 1,
    kind: "patient_assigned",
    title: "Nuevo paciente asignado",
    body: "Se te asignó a Ana Ruiz.",
    link: "/patients/7",
    is_read: false,
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderBell() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<NotificationBell />} />
        <Route path="/patients/:id" element={<p>Ficha del paciente</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getUnreadCount.mockResolvedValue(0);
    api.listNotifications.mockResolvedValue([]);
  });

  it("muestra el conteo de no leídas en el badge", async () => {
    api.getUnreadCount.mockResolvedValue(3);
    renderBell();
    expect(
      await screen.findByRole("button", { name: "Notificaciones (3 sin leer)" }),
    ).toHaveTextContent("3");
  });

  it("no muestra badge si no hay no leídas", async () => {
    renderBell();
    await waitFor(() => expect(api.getUnreadCount).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Notificaciones" })).toHaveTextContent(
      "",
    );
  });

  it("muestra el estado vacío al abrir sin notificaciones", async () => {
    renderBell();
    await userEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    expect(await screen.findByText("No tienes notificaciones.")).toBeInTheDocument();
  });

  it("marca como leída y navega al enlace al hacer clic", async () => {
    api.getUnreadCount.mockResolvedValue(1);
    api.listNotifications.mockResolvedValue([notification()]);
    api.markNotificationRead.mockResolvedValue(
      notification({ is_read: true, read_at: new Date().toISOString() }),
    );
    renderBell();

    await userEvent.click(
      await screen.findByRole("button", { name: "Notificaciones (1 sin leer)" }),
    );
    await userEvent.click(await screen.findByText("Nuevo paciente asignado"));

    expect(api.markNotificationRead).toHaveBeenCalledWith(1);
    expect(await screen.findByText("Ficha del paciente")).toBeInTheDocument();
  });

  it("marca todas como leídas y quita el badge", async () => {
    api.getUnreadCount.mockResolvedValue(2);
    api.listNotifications.mockResolvedValue([
      notification(),
      notification({ id: 2, title: "Caso finalizado" }),
    ]);
    api.markAllNotificationsRead.mockResolvedValue(2);
    renderBell();

    await userEvent.click(
      await screen.findByRole("button", { name: "Notificaciones (2 sin leer)" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Marcar todas como leídas" }),
    );

    expect(api.markAllNotificationsRead).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Notificaciones" }),
    ).toBeInTheDocument();
  });
});

describe("Navbar", () => {
  const baseUser: AuthUser = {
    id: 1,
    username: "ana",
    email: "ana@fouees.edu.sv",
    first_name: "Ana",
    last_name: "Ruiz",
    role: "estudiante",
    permissions: [],
  };

  function renderNavbar(user: AuthUser) {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Navbar user={user} onLogout={() => {}} />
        </MemoryRouter>
      </ThemeProvider>,
    );
  }

  beforeEach(() => {
    api.getUnreadCount.mockResolvedValue(0);
    // jsdom no trae matchMedia y el ThemeProvider lo usa.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  });

  it("muestra la campana solo con notifications.view", async () => {
    const { unmount } = renderNavbar(baseUser);
    expect(screen.queryByRole("button", { name: /Notificaciones/ })).toBeNull();
    unmount();

    renderNavbar({ ...baseUser, permissions: ["notifications.view"] });
    expect(
      await screen.findByRole("button", { name: "Notificaciones" }),
    ).toBeInTheDocument();
  });
});
