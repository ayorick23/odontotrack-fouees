import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../../context/AuthContext";
import { Profile } from "./Profile";

const USER: AuthUser = {
  id: 7,
  username: "robertogr",
  email: "robertogr@fouees.edu.sv",
  first_name: "Roberto",
  last_name: "García",
  role: "recepcion",
  permissions: [],
  photo: null,
};

const mocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  refreshUser: vi.fn(),
  fieldErrors: {} as Record<string, string>,
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ user: USER, refreshUser: mocks.refreshUser }),
}));
vi.mock("../../services/accounts", () => ({ updateProfile: mocks.updateProfile }));
vi.mock("../../services/users", () => ({
  changeOwnPassword: vi.fn(),
  getUserFieldErrors: () => mocks.fieldErrors,
  getUserError: (_error: unknown, fallback: string) => fallback,
}));

describe("Profile", () => {
  beforeEach(() => {
    mocks.updateProfile.mockReset();
    mocks.refreshUser.mockReset().mockResolvedValue(undefined);
    mocks.fieldErrors = {};
  });

  it("muestra correo y usuario sin poder editarlos, y Guardar empieza desactivado", () => {
    render(<Profile />);
    expect(screen.getByText("robertogr@fouees.edu.sv")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /correo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("no envía si el nombre queda vacío", async () => {
    render(<Profile />);
    await userEvent.clear(screen.getByLabelText("Nombre"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("guarda nombre y apellido sin tocar la foto y refresca la sesión", async () => {
    mocks.updateProfile.mockResolvedValue(USER);
    render(<Profile />);
    await userEvent.clear(screen.getByLabelText("Nombre"));
    await userEvent.type(screen.getByLabelText("Nombre"), "  Rob ");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith(
        { first_name: "Rob", last_name: "García" },
        undefined,
      ),
    );
    expect(mocks.refreshUser).toHaveBeenCalled();
  });

  it("muestra bajo el campo el error que devuelve el backend", async () => {
    mocks.updateProfile.mockRejectedValue(new Error("400"));
    mocks.fieldErrors = { last_name: "Asegúrese de que este campo no tenga más de 150 caracteres." };
    render(<Profile />);
    await userEvent.type(screen.getByLabelText("Apellido"), " López");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("Asegúrese de que este campo no tenga más de 150 caracteres."),
    ).toBeInTheDocument();
  });
});
