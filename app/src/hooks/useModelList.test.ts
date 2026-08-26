import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useModelList } from "./useModelList";

/**
 * Hook useModelList — expõe a lista de modelos vindos do engine (Fase 2 — E10).
 */

describe("useModelList", () => {
  it("inicia com loading true e lista vazia", () => {
    const { result } = renderHook(() => useModelList());
    expect(result.current.loading).toBe(true);
    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
