import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChangePasswordModal } from "./ChangePasswordModal";

const api = vi.hoisted(() => ({
  changeOwnPassword: vi.fn(),
  fieldErrors: {} as Record<string, string>,
}));

vi.mock("../services/users", () => ({
  changeOwnPassword: api.changeOwnPassword,
  getUserFieldErrors: () => api.fieldErrors,
  getUserError: (_error: unknown, fallback: string) => fallback,
}));

async function fill(current: string, next: string, confirm: string) {
  await userEvent.type(screen.getByLabelText("Contraseña actual"), current);
  await userEvent.type(screen.getByLabelText("Nueva contraseña"), next);
  await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), confirm);
  await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
}

describe("ChangePasswordModal", () => {
  beforeEach(() => {
    api.changeOwnPassword.mockReset();
    api.fieldErrors = {};
  });

  it("no envía si la confirmación no coincide", async () => {
    render(<ChangePasswordModal isOpen onClose={() => {}} />);
    await fill("Actual2026!", "NuevaClave2026!", "OtraCosa2026!");

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(api.changeOwnPassword).not.toHaveBeenCalled();
  });

  it("muestra el error del backend bajo la contraseña actual", async () => {
    api.changeOwnPassword.mockRejectedValue(new Error("400"));
    api.fieldErrors = { current_password: "La contraseña actual no es correcta." };
    render(<ChangePasswordModal isOpen onClose={() => {}} />);
    await fill("mala", "NuevaClave2026!", "NuevaClave2026!");

    expect(
      await screen.findByText("La contraseña actual no es correcta."),
    ).toBeInTheDocument();
  });

  it("cambia la contraseña y cierra", async () => {
    api.changeOwnPassword.mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ChangePasswordModal isOpen onClose={onClose} />);
    await fill("Actual2026!", "NuevaClave2026!", "NuevaClave2026!");

    await waitFor(() =>
      expect(api.changeOwnPassword).toHaveBeenCalledWith({
        current_password: "Actual2026!",
        new_password: "NuevaClave2026!",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
