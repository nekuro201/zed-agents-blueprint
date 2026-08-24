import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_ENGINE_PREFS, ENGINE_PREFS_KEY, loadEnginePrefs, saveEnginePrefs } from "./enginePrefs";

describe("enginePrefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("default: mock false, modelo flash", () => {
    expect(loadEnginePrefs()).toEqual(DEFAULT_ENGINE_PREFS);
  });

  it("persiste e recarrega", () => {
    saveEnginePrefs({ mock: true, defaultModel: "llmgateway/grok-4-5" });
    expect(loadEnginePrefs().mock).toBe(true);
    expect(loadEnginePrefs().defaultModel).toBe("llmgateway/grok-4-5");
  });

  it("corrompido volta ao default", () => {
    localStorage.setItem(ENGINE_PREFS_KEY, "{x");
    expect(loadEnginePrefs()).toEqual(DEFAULT_ENGINE_PREFS);
  });
});
