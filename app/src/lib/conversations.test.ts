import { describe, it, expect, beforeEach } from "vitest";
import { loadConversations, saveConversations, conversationsFor, newId, deriveConversationLabel, type ConversationsMap } from "./conversations";

describe("conversations (persistência)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retorna {} quando nada foi salvo", () => {
    expect(loadConversations()).toEqual({});
  });

  it("persiste e recarrega as conversas (round-trip)", () => {
    const map: ConversationsMap = {
      "/proj": [
        { id: "c1", label: "Conversa 1", createdAt: 1, messages: [{ id: "m1", role: "user", text: "oi" }] },
      ],
    };
    saveConversations(map);
    expect(loadConversations()).toEqual(map);
  });

  it("conversationsFor retorna a lista do scope ou vazia", () => {
    const map: ConversationsMap = { "/a": [{ id: "x", label: "X", createdAt: 0, messages: [] }] };
    expect(conversationsFor(map, "/a")).toHaveLength(1);
    expect(conversationsFor(map, "/b")).toEqual([]);
  });

  it("newId gera ids únicos", () => {
    const a = newId();
    const b = newId();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("volta para {} se o dado salvo for corrompido", () => {
    localStorage.setItem("pi-factory:conversations", "{ não é json");
    expect(loadConversations()).toEqual({});
  });

  it("deriveConversationLabel trunca o primeiro prompt", () => {
    expect(deriveConversationLabel("Criar tela de login com JWT")).toBe("Criar tela de login com JWT");
    expect(deriveConversationLabel("Este é um prompt muito longo que deve ser truncado para caber no título")).toBe("Este é um prompt muito longo que deve se…");
    expect(deriveConversationLabel("   ")).toBe("Nova conversa");
  });
});
