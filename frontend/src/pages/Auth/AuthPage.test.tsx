import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../context/ThemeContext";
import { AuthPage } from "./AuthPage";

const mocks = vi.hoisted(() => ({
  registerStudent: vi.fn(),
  login: vi.fn(),
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ isReady: true, isAuthenticated: false, login: mocks.login }),
}));

vi.mock("../../services/registration", async () => {
  const actual = await vi.importActual<typeof import("../../services/registration")>(
    "../../services/registration",
  );
  return { ...actual, registerStudent: mocks.registerStudent };
});

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: <AuthPage />,
        children: [{ path: "/login" }, { path: "/registro" }],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return router;
}

/** Solo el formulario de registro (el de ingreso sigue en el DOM, oculto). */
const registerForm = () =>
  within(screen.getByRole("heading", { name: "Crea tu cuenta" }).closest("section")!);

const visibleHeading = (name: string) =>
  screen.getByRole("heading", { name, hidden: false });

describe("Ingresar y crear cuenta", () => {
  beforeEach(() => {
    mocks.registerStudent.mockReset();
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

  it("cambia entre ingresar y crear cuenta, y la URL lo refleja", async () => {
    const user = userEvent.setup();
    const router = renderAt("/login");
    expect(visibleHeading("Bienvenido de nuevo")).toBeInTheDocument();
    // El formulario inactivo queda fuera del alcance del teclado y lectores.
    expect(screen.queryByRole("heading", { name: "Crea tu cuenta" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(router.state.location.pathname).toBe("/registro");
    expect(visibleHeading("Crea tu cuenta")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bienvenido de nuevo" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(router.state.location.pathname).toBe("/login");
  });

  it("valida el correo institucional y la contraseña antes de enviar", async () => {
    const user = userEvent.setup();
    renderAt("/registro");
    await user.type(registerForm().getByLabelText("Nombres"), "Dereck");
    await user.type(registerForm().getByLabelText("Apellidos"), "Méndez");
    await user.type(registerForm().getByLabelText("Correo institucional"), "dereck@gmail.com");
    await user.type(registerForm().getByLabelText("Contraseña"), "corta");
    await user.click(registerForm().getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText(/Usa tu correo institucional/)).toBeInTheDocument();
    expect(screen.getByText("La contraseña no cumple todos los requisitos")).toBeInTheDocument();
    expect(mocks.registerStudent).not.toHaveBeenCalled();
  });

  it("sin backend de registro avisa que todavía no está habilitado", async () => {
    const user = userEvent.setup();
    mocks.registerStudent.mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
    renderAt("/registro");
    await user.type(registerForm().getByLabelText("Nombres"), "Dereck");
    await user.type(registerForm().getByLabelText("Apellidos"), "Méndez");
    await user.type(registerForm().getByLabelText("Correo institucional"), "2025010371@cvirtualuees.edu.sv");
    await user.type(registerForm().getByLabelText("Contraseña"), "Odonto2026x");
    await user.type(registerForm().getByLabelText("Confirmar contraseña"), "Odonto2026x");
    await user.click(registerForm().getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() =>
      expect(mocks.registerStudent).toHaveBeenCalledWith({
        first_name: "Dereck",
        last_name: "Méndez",
        email: "2025010371@cvirtualuees.edu.sv",
        password: "Odonto2026x",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/todavía no está habilitado/);
  });
});
