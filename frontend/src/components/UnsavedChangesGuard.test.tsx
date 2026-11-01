import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, RouterProvider, createMemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { UnsavedChangesGuard } from "./UnsavedChangesGuard";

function renderGuard(onSave: () => Promise<boolean>, when = true) {
  const router = createMemoryRouter(
    [
      {
        path: "/patients/1",
        element: (
          <>
            <p>Ficha</p>
            <Link to="/patients">Ir al directorio</Link>
            <Link to="/patients/1?tab=odontograma">Otra pestaña</Link>
            <UnsavedChangesGuard when={when} subject="el odontograma" onSave={onSave} />
          </>
        ),
      },
      { path: "/patients", element: <p>Directorio</p> },
    ],
    { initialEntries: ["/patients/1"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("UnsavedChangesGuard", () => {
  it("sin cambios deja salir", async () => {
    renderGuard(vi.fn(), false);
    fireEvent.click(screen.getByText("Ir al directorio"));
    expect(await screen.findByText("Directorio")).toBeInTheDocument();
  });

  it("con cambios pregunta y Seguir editando se queda", async () => {
    renderGuard(vi.fn());
    fireEvent.click(screen.getByText("Ir al directorio"));
    expect(await screen.findByText("Hay cambios sin guardar")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Seguir editando"));
    await waitFor(() =>
      expect(screen.queryByText("Hay cambios sin guardar")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Ficha")).toBeInTheDocument();
  });

  it("cambiar solo los parámetros de la URL no cuenta como salir", async () => {
    const router = renderGuard(vi.fn());
    fireEvent.click(screen.getByText("Otra pestaña"));
    await waitFor(() => expect(router.state.location.search).toBe("?tab=odontograma"));
    expect(screen.queryByText("Hay cambios sin guardar")).not.toBeInTheDocument();
  });

  it("Guardar y salir guarda y navega", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    renderGuard(onSave);
    fireEvent.click(screen.getByText("Ir al directorio"));
    fireEvent.click(await screen.findByText("Guardar y salir"));
    expect(await screen.findByText("Directorio")).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("si el guardado falla, se queda", async () => {
    renderGuard(vi.fn().mockResolvedValue(false));
    fireEvent.click(screen.getByText("Ir al directorio"));
    fireEvent.click(await screen.findByText("Guardar y salir"));
    await waitFor(() =>
      expect(screen.queryByText("Hay cambios sin guardar")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Ficha")).toBeInTheDocument();
  });

  it("Descartar y salir navega sin guardar", async () => {
    const onSave = vi.fn();
    renderGuard(onSave);
    fireEvent.click(screen.getByText("Ir al directorio"));
    fireEvent.click(await screen.findByText("Descartar y salir"));
    expect(await screen.findByText("Directorio")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
