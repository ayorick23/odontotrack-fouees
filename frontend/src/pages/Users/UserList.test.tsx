import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserList } from "./UserList";

const api = vi.hoisted(() => ({
  listUsers: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  createUser: vi.fn(),
  resetUserPassword: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: {
    id: 1,
    username: "soporte",
    first_name: "Sofía",
    last_name: "Soporte",
    email: "",
    role: "soporte",
    permissions: ["users.view", "users.create", "users.edit", "users.delete"],
  },
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ user: auth.user }),
}));

vi.mock("../../services/users", () => ({
  listUsers: api.listUsers,
  updateUser: api.updateUser,
  deleteUser: api.deleteUser,
  createUser: api.createUser,
  resetUserPassword: api.resetUserPassword,
  getUserFieldErrors: () => ({}),
  getUserError: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

function account(overrides: Record<string, unknown>) {
  return {
    id: 0,
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "estudiante",
    is_active: true,
    last_login: null,
    date_joined: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

const self = account({ id: 1, username: "soporte", first_name: "Sofía", last_name: "Soporte", role: "soporte" });
const admin = account({ id: 2, username: "admin", first_name: "Ana", last_name: "Admin", role: "admin" });
const student = account({ id: 3, username: "nlopez", first_name: "Nadia", last_name: "López" });

async function findRow(name: string) {
  return (await screen.findByText(name)).closest("tr") as HTMLElement;
}

describe("UserList", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) {
      fn.mockReset();
    }
    api.listUsers.mockResolvedValue({
      count: 3,
      next: null,
      previous: null,
      results: [self, admin, student],
    });
  });

  it("desactiva una cuenta tras confirmar", async () => {
    api.updateUser.mockResolvedValue({ ...student, is_active: false });
    render(<UserList />);

    const row = await findRow("Nadia López");
    await userEvent.click(within(row).getByRole("button", { name: "Desactivar" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Desactivar" }));

    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(3, { is_active: false }));
    expect(await within(await findRow("Nadia López")).findByText("Desactivada")).toBeInTheDocument();
  });

  it("no deja desactivar ni eliminar la propia cuenta", async () => {
    render(<UserList />);
    const row = await findRow("Sofía Soporte");

    expect(
      within(row).getByRole("button", { name: "No puedes desactivar tu propia cuenta" }),
    ).toBeDisabled();
    expect(
      within(row).getByRole("button", { name: "No puedes eliminar tu propia cuenta" }),
    ).toBeDisabled();
  });

  it("soporte no puede gestionar una cuenta de administrador", async () => {
    render(<UserList />);
    const row = await findRow("Ana Admin");

    const locked = within(row).getAllByRole("button", {
      name: "Solo un administrador gestiona cuentas de administrador",
    });
    expect(locked).toHaveLength(4);
    for (const button of locked) {
      expect(button).toBeDisabled();
    }
  });

  it("muestra por qué no se pudo eliminar una cuenta con historial", async () => {
    api.deleteUser.mockRejectedValue(
      new Error("Esta cuenta tiene historial clínico y no se puede eliminar."),
    );
    render(<UserList />);
    const row = await findRow("Nadia López");

    await userEvent.click(within(row).getByRole("button", { name: "Eliminar" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Esta cuenta tiene historial clínico y no se puede eliminar.",
    );
  });

  it("busca en el servidor", async () => {
    render(<UserList />);
    await screen.findByText("Nadia López");

    await userEvent.type(screen.getByPlaceholderText("Nombre, usuario o correo"), "nadia");

    await waitFor(() =>
      expect(api.listUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "nadia", page: 1 }),
      ),
    );
  });
});
