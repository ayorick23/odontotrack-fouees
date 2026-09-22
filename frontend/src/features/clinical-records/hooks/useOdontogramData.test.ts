import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emptyOdontogram } from "../types";

const api = vi.hoisted(() => ({
  getOdontogram: vi.fn(),
  saveOdontogram: vi.fn(),
}));

vi.mock("../../../services/odontogram", () => ({
  getOdontogram: api.getOdontogram,
  saveOdontogram: api.saveOdontogram,
}));

import { useOdontogramData } from "./useOdontogramData";

describe("useOdontogramData", () => {
  beforeEach(() => {
    api.getOdontogram.mockReset();
    api.saveOdontogram.mockReset();
  });

  it("carga el odontograma y guarda cambios sucios", async () => {
    const loaded = emptyOdontogram();
    loaded.oralMarks.placa = true;
    api.getOdontogram.mockResolvedValue(loaded);
    api.saveOdontogram.mockImplementation(
      async (_id: number, value: typeof loaded) => value,
    );

    const { result } = renderHook(() => useOdontogramData(7));

    await waitFor(() => {
      expect(result.current.loadStatus).toBe("ready");
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.value.oralMarks.placa).toBe(true);

    act(() => {
      result.current.onChange({
        ...result.current.value,
        oralMarks: { placa: true, sangrado: true, sarro: false },
      });
    });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.save();
    });

    expect(api.saveOdontogram).toHaveBeenCalledWith(7, {
      ...loaded,
      oralMarks: { placa: true, sangrado: true, sarro: false },
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("deshace los cambios no guardados", async () => {
    const loaded = emptyOdontogram();
    loaded.oralMarks.placa = true;
    api.getOdontogram.mockResolvedValue(loaded);

    const { result } = renderHook(() => useOdontogramData(7));

    await waitFor(() => {
      expect(result.current.loadStatus).toBe("ready");
    });

    act(() => {
      result.current.onChange({
        ...result.current.value,
        oralMarks: { placa: true, sangrado: true, sarro: false },
      });
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.discard();
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.value.oralMarks).toEqual({
      placa: true,
      sangrado: false,
      sarro: false,
    });
    expect(result.current.editorKey).toBe(1);
  });
});
