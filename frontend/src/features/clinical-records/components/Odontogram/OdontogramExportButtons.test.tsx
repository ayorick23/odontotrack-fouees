import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./engine", () => ({
  exportChartPng: vi.fn(async () => undefined),
  exportChartPdf: vi.fn(async () => undefined),
}));

import { OdontogramExportButtons } from "./OdontogramExportButtons";

describe("OdontogramExportButtons", () => {
  it("muestra PNG y PDF", () => {
    render(
      <div>
        <OdontogramExportButtons />
      </div>,
    );
    expect(screen.getByRole("button", { name: "Exportar PNG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeInTheDocument();
  });
});
