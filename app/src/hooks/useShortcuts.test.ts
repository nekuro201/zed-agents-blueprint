import { describe, it, expect, vi } from "vitest";
import { renderHook, fireEvent } from "@testing-library/react";
import { useShortcuts } from "./useShortcuts";

function mount() {
  const handlers = {
    onTogglePalette: vi.fn(),
    onClosePalette: vi.fn(),
    onSelectView: vi.fn(),
  };
  renderHook(() => useShortcuts(handlers));
  return handlers;
}

describe("useShortcuts", () => {
  it("⌘K alterna a palette", () => {
    const h = mount();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(h.onTogglePalette).toHaveBeenCalledTimes(1);
  });

  it("⌘1/⌘2/⌘3 seleciona a view correspondente", () => {
    const h = mount();
    fireEvent.keyDown(window, { key: "2", metaKey: true });
    expect(h.onSelectView).toHaveBeenCalledWith(2);
  });

  it("Escape fecha a palette", () => {
    const h = mount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(h.onClosePalette).toHaveBeenCalledTimes(1);
  });

  it("ignora teclas sem modificador", () => {
    const h = mount();
    fireEvent.keyDown(window, { key: "k" });
    fireEvent.keyDown(window, { key: "2" });
    expect(h.onTogglePalette).not.toHaveBeenCalled();
    expect(h.onSelectView).not.toHaveBeenCalled();
  });
});
