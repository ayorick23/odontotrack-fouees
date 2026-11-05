import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IndicatedPractices } from "./IndicatedPractices";

const practice = (tooth: number, treatment: string, matched = false) => ({
  tooth,
  treatment,
  label: `${tooth} · ${treatment}`,
  matched,
});

describe("IndicatedPractices", () => {
  it("muestra dos etiquetas y el resto en +N", () => {
    render(
      <IndicatedPractices
        practices={[
          practice(11, "a"),
          practice(12, "b"),
          practice(13, "c"),
          practice(14, "d"),
        ]}
      />,
    );
    expect(screen.getByTitle("11 · a")).toHaveTextContent("11 · a");
    expect(screen.getByTitle("12 · b")).toBeInTheDocument();
    expect(screen.queryByTitle("13 · c")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toHaveAttribute("title", "13 · c\n14 · d");
  });

  it("resalta la que coincide con la búsqueda", () => {
    render(
      <IndicatedPractices
        practices={[practice(18, "endo", true), practice(17, "resina")]}
      />,
    );
    expect(screen.getByTitle("18 · endo").className).toContain("bg-action");
    expect(screen.getByTitle("17 · resina").className).not.toContain("bg-action");
  });

  it("acepta dos tratamientos en la misma pieza", () => {
    render(
      <IndicatedPractices practices={[practice(18, "endo"), practice(18, "corona")]} />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
