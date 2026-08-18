import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_MODEL_CONFIG, loadModelConfig, saveModelConfig, STORAGE_KEY } from "./modelConfig";

describe("modelConfig (persistência manual de modelos)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retorna os defaults quando nada foi salvo", () => {
    expect(loadModelConfig()).toEqual(DEFAULT_MODEL_CONFIG);
  });

  it("persiste e recarrega a configuração completa", () => {
    const cfg = {
      plan: { model: "llmgateway/deepseek-v4-flash", thinking: "Low" },
      techlead: { model: "llmgateway/grok-4-5", thinking: "Medium" },
      coder: { model: "llmgateway/deepseek-v4-flash", thinking: "High" },
      qa: { model: "llmgateway/grok-4-5", thinking: "Maximum" },
    };
    saveModelConfig(cfg);
    expect(loadModelConfig()).toEqual(cfg);
  });

  it("volta para os defaults se o dado salvo estiver corrompido", () => {
    localStorage.setItem(STORAGE_KEY, "{ não é um json válido ");
    expect(loadModelConfig()).toEqual(DEFAULT_MODEL_CONFIG);
  });

  it("volta para os defaults se o dado salvo não obedecer o schema (Zod)", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ plan: { model: "", thinking: "" } }));
    expect(loadModelConfig()).toEqual(DEFAULT_MODEL_CONFIG);
  });
});
