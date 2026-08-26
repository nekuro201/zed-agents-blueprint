import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_MODEL_CONFIG, loadModelConfig, saveModelConfig, STORAGE_KEY } from "./modelConfig";

describe("modelConfig (persistência manual de modelos)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retorna os defaults quando nada foi salvo", () => {
    expect(loadModelConfig()).toEqual(DEFAULT_MODEL_CONFIG);
  });

  it("expõe os 7 papéis no default (Planejador + 6 do loop)", () => {
    expect(Object.keys(DEFAULT_MODEL_CONFIG)).toEqual([
      "planejador",
      "leitor",
      "techlead",
      "coder",
      "testador",
      "qa",
      "crise",
    ]);
  });

  it("persiste e recarrega a configuração completa", () => {
    const cfg = {
      planejador: { model: "llmgateway/deepseek-v4-flash", thinking: "Standard" },
      leitor: { model: "llmgateway/deepseek-v4-flash", thinking: "Standard" },
      techlead: { model: "llmgateway/grok-4-5", thinking: "Medium" },
      coder: { model: "llmgateway/deepseek-v4-flash", thinking: "High" },
      testador: { model: "llmgateway/deepseek-v4-flash", thinking: "Standard" },
      qa: { model: "llmgateway/grok-4-5", thinking: "Maximum" },
      crise: { model: "llmgateway/grok-4-5", thinking: "Medium" },
    };
    saveModelConfig(cfg);
    expect(loadModelConfig()).toEqual(cfg);
  });

  it("volta para os defaults se o dado salvo estiver corrompido", () => {
    localStorage.setItem(STORAGE_KEY, "{ não é um json válido ");
    expect(loadModelConfig()).toEqual(DEFAULT_MODEL_CONFIG);
  });

  it("volta para os defaults se o dado salvo não obedecer o schema (Zod)", () => {
    const invalid = { ...DEFAULT_MODEL_CONFIG, coder: { model: "", thinking: "" } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invalid));
    expect(loadModelConfig()).toEqual(DEFAULT_MODEL_CONFIG);
  });
});
