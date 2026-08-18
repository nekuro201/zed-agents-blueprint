import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActiveView } from "./useActiveView";

describe("useActiveView", () => {
  it("inicia em chat-thread por padrão", () => {
    const { result } = renderHook(() => useActiveView());
    expect(result.current.view).toBe("chat-thread");
  });

  it("permite trocar para outra view", () => {
    const { result } = renderHook(() => useActiveView());
    act(() => result.current.setView("workspace"));
    expect(result.current.view).toBe("workspace");
  });

  it("aceita uma view inicial customizada", () => {
    const { result } = renderHook(() => useActiveView("chat-global"));
    expect(result.current.view).toBe("chat-global");
  });
});
