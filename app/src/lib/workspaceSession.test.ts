import { describe, it, expect, beforeEach } from "vitest";
import {
  loadRecents,
  upsertRecent,
  removeRecent,
  parseSession,
  RECENTS_KEY,
} from "./workspaceSession";

describe("workspaceSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadRecents sem LS retorna lista vazia", () => {
    expect(loadRecents()).toEqual([]);
  });

  it("upsertRecent coloca no topo, preenche openedAt e faz dedupe por path", () => {
    upsertRecent({ name: "A", path: "/tmp/a" });
    upsertRecent({ name: "B", path: "/tmp/b" });
    const first = loadRecents();
    expect(first.map((r) => r.path)).toEqual(["/tmp/b", "/tmp/a"]);
    expect(first[0]!.openedAt).toBeGreaterThan(0);

    upsertRecent({ name: "A2", path: "/tmp/a" });
    const again = loadRecents();
    expect(again).toHaveLength(2);
    expect(again[0]).toMatchObject({ name: "A2", path: "/tmp/a" });
  });

  it("removeRecent remove pelo path", () => {
    upsertRecent({ name: "A", path: "/tmp/a" });
    upsertRecent({ name: "B", path: "/tmp/b" });
    removeRecent("/tmp/a");
    expect(loadRecents().map((r) => r.path)).toEqual(["/tmp/b"]);
  });

  it("JSON corrompido ou schema inválido volta []", () => {
    localStorage.setItem(RECENTS_KEY, "{ não json");
    expect(loadRecents()).toEqual([]);
    localStorage.setItem(RECENTS_KEY, JSON.stringify([{ name: "x" }]));
    expect(loadRecents()).toEqual([]);
  });

  it("parseSession rejeita objeto sem path", () => {
    expect(parseSession({ name: "x", openedAt: 1 })).toBeNull();
    expect(parseSession({ name: "x", path: "/tmp/x", openedAt: 1 })).toMatchObject({
      name: "x",
      path: "/tmp/x",
    });
  });
});
