import { describe, it, expect, vi } from "vitest";
import { renderHook, fireEvent } from "@testing-library/react";
import { useShortcuts } from "./useShortcuts";

function mount() {
  const handlers = {
    onTogglePalette: vi.fn(),
    onClosePalette: vi.fn(),
    onSelectView: vi.fn(),
    onToggleExplorer: vi.fn(),
    onGenerateGraph: vi.fn(),
    onViewGraph: vi.fn(),
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

  it("⌘B alterna o explorer", () => {
    const h = mount();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(h.onToggleExplorer).toHaveBeenCalledTimes(1);
  });

  it("⌘G dispara a geração do grafo", () => {
    const h = mount();
    fireEvent.keyDown(window, { key: "g", metaKey: true });
    expect(h.onGenerateGraph).toHaveBeenCalledTimes(1);
  });

  it("⌘V dispara ver grafo quando o foco não é um campo editável", () => {
    const h = mount();
    fireEvent.keyDown(window, { key: "v", metaKey: true });
    expect(h.onViewGraph).toHaveBeenCalledTimes(1);
  });

  it("⌘V NÃO dispara dentro de input (preserva colar)", () => {
    const h = mount();
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "v", metaKey: true });
    expect(h.onViewGraph).not.toHaveBeenCalled();
    input.remove();
  });

  it("ignora teclas sem modificador", () => {
    const h = mount();
    fireEvent.keyDown(window, { key: "k" });
    fireEvent.keyDown(window, { key: "2" });
    expect(h.onTogglePalette).not.toHaveBeenCalled();
    expect(h.onSelectView).not.toHaveBeenCalled();
  });
});
