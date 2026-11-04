import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  exportChartPng: vi.fn(async () => undefined),
  exportChartPdf: vi.fn(async () => undefined),
}));

vi.mock("./engine", () => engine);

import { OdontogramExportButtons } from "./OdontogramExportButtons";

describe("OdontogramExportButtons", () => {
  it("agrupa PNG y PDF en el menú Exportar", async () => {
    const user = userEvent.setup();
    render(<OdontogramExportButtons />);
    expect(screen.queryByRole("menuitem", { name: "Exportar PNG" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Exportar" }));
    expect(screen.getByRole("menuitem", { name: "Exportar PNG" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Exportar PDF" }));
    expect(engine.exportChartPdf).toHaveBeenCalledTimes(1);
    // Al elegir, el menú se cierra.
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("se cierra con Escape", async () => {
    const user = userEvent.setup();
    render(<OdontogramExportButtons />);
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
