import { describe, it, expect } from "vitest";
import { VIEWS, viewByShortcut } from "./views";

describe("viewByShortcut", () => {
  it("mapeia ⌘1→chat-global, ⌘2→chat-thread, ⌘3→workspace", () => {
    expect(viewByShortcut(1)).toBe("chat-global");
    expect(viewByShortcut(2)).toBe("chat-thread");
    expect(viewByShortcut(3)).toBe("workspace");
  });

  it("retorna undefined fora do intervalo", () => {
    expect(viewByShortcut(9)).toBeUndefined();
  });
});

describe("VIEWS (rail)", () => {
  it("inclui a view Grafo entre o Chat da Thread e o Loop, sem atalho numérico", () => {
    const ids = VIEWS.map((v) => v.id);
    expect(ids).toEqual(["chat-global", "chat-thread", "graph", "workspace"]);
    const graph = VIEWS.find((v) => v.id === "graph");
    expect(graph?.title).toBe("Grafo");
    expect(graph?.shortcut).toBeUndefined();
  });
});
