import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { findModelPricing, parseModelsResponse, registerModelInPiAgent } from "./models";

/**
 * Testes do parser da resposta da API do llmgateway (Fase 1 — E10).
 */

const SAMPLE_RESPONSE = {
  data: [
    {
      id: "llmgateway/deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      display_name: "DeepSeek V4 Flash",
      description: "Fast reasoning",
      family: "deepseek",
      providers: [
        {
          providerId: "llmgateway",
          externalId: "deepseek-v4-flash",
          pricing: {
            prompt: "0.00000028",
            completion: "0.00000042",
            input_cache_read: "0.000000028",
            input_cache_write: "0.00000028",
          },
          streaming: true,
          tools: true,
        },
      ],
      pricing: {
        prompt: "0.00000028",
        completion: "0.00000042",
      },
      context_length: 128000,
      stability: "stable",
    },
    {
      id: "llmgateway/grok-4-5",
      name: "Grok 4.5",
      display_name: "Grok 4.5",
      description: "xAI flagship",
      family: "grok",
      providers: [
        {
          providerId: "llmgateway",
          externalId: "grok-4-5",
          streaming: true,
          tools: true,
        },
      ],
      context_length: 200000,
      stability: "stable",
    },
  ],
};

describe("parseModelsResponse (Fase 1 — E10)", () => {
  it("extrai modelos com pricing do primeiro provider", () => {
    const models = parseModelsResponse(SAMPLE_RESPONSE as { data: unknown[] });
    expect(models).toHaveLength(2);

    const deepseek = models[0];
    expect(deepseek.id).toBe("llmgateway/deepseek-v4-flash");
    expect(deepseek.name).toBe("DeepSeek V4 Flash");
    expect(deepseek.provider).toBe("llmgateway");
    expect(deepseek.pricing).toEqual({ prompt: 0.28, completion: 0.42 });
  });

  it("modelo sem pricing no provider → pricing null", () => {
    const models = parseModelsResponse(SAMPLE_RESPONSE as { data: unknown[] });
    const grok = models[1];
    expect(grok.name).toBe("Grok 4.5");
    expect(grok.pricing).toBeNull();
  });

  it("resposta vazia → lista vazia", () => {
    expect(parseModelsResponse({ data: [] })).toEqual([]);
  });

  it("resposta sem campo data → lista vazia (nunca lança)", () => {
    expect(parseModelsResponse({} as { data: unknown[] })).toEqual([]);
  });

  it("ignora modelos sem id", () => {
    const models = parseModelsResponse({
      data: [{ name: "sem id", providers: [{ providerId: "x" }] }],
    } as unknown as { data: unknown[] });
    expect(models).toEqual([]);
  });

  it("ignora modelos sem providers", () => {
    const models = parseModelsResponse({
      data: [{ id: "x/y" }],
    } as unknown as { data: unknown[] });
    expect(models).toEqual([]);
  });

  it("usa pricing de top-level quando provider não tem", () => {
    const models = parseModelsResponse({
      data: [
        {
          id: "x/y",
          name: "Y",
          providers: [{ providerId: "x", externalId: "y" }],
          pricing: { prompt: "0.00000010", completion: "0.00000015" },
        },
      ],
    } as unknown as { data: unknown[] });
    expect(models[0].pricing).toBeDefined();
    if (models[0].pricing) {
      expect(models[0].pricing.prompt).toBeCloseTo(0.1);
      expect(models[0].pricing.completion).toBeCloseTo(0.15);
    }
  });

  it("prioriza pricing do provider sobre top-level", () => {
    const models = parseModelsResponse({
      data: [
        {
          id: "x/y",
          name: "Y",
          providers: [
            {
              providerId: "x",
              pricing: { prompt: "0.00000011", completion: "0.00000016" },
            },
          ],
          pricing: { prompt: "0.00000010", completion: "0.00000015" },
        },
      ],
    } as unknown as { data: unknown[] });
    expect(models[0].pricing).toEqual({ prompt: 0.11, completion: 0.16 });
  });

  it("normaliza id sem provider usando externalId do provider", () => {
    const models = parseModelsResponse({
      data: [
        {
          id: "deepseek-v4-pro",
          name: "DeepSeek V4 Pro",
          providers: [
            {
              providerId: "llmgateway",
              externalId: "deepseek-v4-pro",
              pricing: { prompt: "0.00000030", completion: "0.00000060" },
            },
          ],
        },
      ],
    } as unknown as { data: unknown[] });
    expect(models[0].id).toBe("llmgateway/deepseek-v4-pro");
    expect(models[0].provider).toBe("llmgateway");
    expect(models[0].pricing).toEqual({ prompt: 0.3, completion: 0.6 });
  });

  it("usa o gateway llmgateway (ignora providerId upstream tipo deepseek)", () => {
    const models = parseModelsResponse({
      data: [
        {
          id: "deepseek-v4-pro",
          name: "DeepSeek V4 Pro",
          providers: [
            {
              providerId: "deepseek",
              externalId: "deepseek-v4-pro",
              pricing: { prompt: "0.00000030", completion: "0.00000060" },
            },
          ],
        },
      ],
    } as unknown as { data: unknown[] });
    expect(models[0].id).toBe("llmgateway/deepseek-v4-pro");
    expect(models[0].provider).toBe("llmgateway");
  });

  it("findModelPricing casa por provider/model mesmo com formatos diferentes", () => {
    const models = parseModelsResponse({
      data: [
        {
          id: "deepseek-v4-pro",
          name: "DeepSeek V4 Pro",
          providers: [
            { providerId: "deepseek", externalId: "deepseek-v4-pro", pricing: { prompt: "0.00000030", completion: "0.00000060" } },
          ],
        },
      ],
    } as unknown as { data: unknown[] });
    // resolvedModel do SDK = "provider/id"
    expect(findModelPricing(models, "llmgateway/deepseek-v4-pro")).toEqual({ prompt: 0.3, completion: 0.6 });
    expect(findModelPricing(models, "deepseek-v4-pro")).toEqual({ prompt: 0.3, completion: 0.6 });
    expect(findModelPricing(models, "other/model")).toBeNull();
  });
});

describe("registerModelInPiAgent (registro no models.json)", () => {
  async function makeModelsJson(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-models-"));
    const file = path.join(dir, "models.json");
    await fs.writeFile(file, JSON.stringify({ providers: { llmgateway: { baseUrl: "https://x", api: "openai-completions", models: [{ id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" }] } } }, null, 2));
    return file;
  }

  it("adiciona um modelo novo com cost convertido do pricing", async () => {
    const file = await makeModelsJson();
    try {
      const r = await registerModelInPiAgent({ modelId: "llmgateway/deepseek-v4-pro", name: "DeepSeek V4 Pro", pricing: { prompt: 0.3, completion: 0.6 } }, file);
      expect(r.ok).toBe(true);
      const data = JSON.parse(await fs.readFile(file, "utf-8"));
      const model = data.providers.llmgateway.models.find((m: { id: string }) => m.id === "deepseek-v4-pro");
      expect(model).toBeDefined();
      expect(model.cost).toEqual({ input: 0.3, output: 0.6, cacheRead: 0, cacheWrite: 0 });
      expect(model.reasoning).toBe(true);
    } finally {
      await fs.rm(path.dirname(file), { recursive: true, force: true });
    }
  });

  it("atualiza um modelo existente sem duplicar", async () => {
    const file = await makeModelsJson();
    try {
      await registerModelInPiAgent({ modelId: "llmgateway/deepseek-v4-flash", name: "DeepSeek V4 Flash", pricing: { prompt: 0.28, completion: 0.42 } }, file);
      const data = JSON.parse(await fs.readFile(file, "utf-8"));
      const models = data.providers.llmgateway.models;
      expect(models.filter((m: { id: string }) => m.id === "deepseek-v4-flash").length).toBe(1);
      expect(models.find((m: { id: string }) => m.id === "deepseek-v4-flash").cost).toEqual({ input: 0.28, output: 0.42, cacheRead: 0, cacheWrite: 0 });
    } finally {
      await fs.rm(path.dirname(file), { recursive: true, force: true });
    }
  });

  it("não adiciona cost quando pricing é null", async () => {
    const file = await makeModelsJson();
    try {
      await registerModelInPiAgent({ modelId: "llmgateway/deepseek-v4-pro", name: "DeepSeek V4 Pro", pricing: null }, file);
      const data = JSON.parse(await fs.readFile(file, "utf-8"));
      const model = data.providers.llmgateway.models.find((m: { id: string }) => m.id === "deepseek-v4-pro");
      expect(model.cost).toBeUndefined();
    } finally {
      await fs.rm(path.dirname(file), { recursive: true, force: true });
    }
  });

  it("não deixa arquivo de lock para trás após registrar", async () => {
    const file = await makeModelsJson();
    try {
      await registerModelInPiAgent({ modelId: "llmgateway/deepseek-v4-pro", name: "DeepSeek V4 Pro", pricing: { prompt: 0.3, completion: 0.6 } }, file);
      await expect(fs.access(`${file}.lock`)).rejects.toThrow();
    } finally {
      await fs.rm(path.dirname(file), { recursive: true, force: true });
    }
  });

  it("serializa registros concorrentes sem perder atualizações (lost update)", async () => {
    const file = await makeModelsJson();
    try {
      await Promise.all([
        registerModelInPiAgent({ modelId: "llmgateway/a", name: "A", pricing: { prompt: 0.1, completion: 0.2 } }, file),
        registerModelInPiAgent({ modelId: "llmgateway/b", name: "B", pricing: { prompt: 0.3, completion: 0.4 } }, file),
      ]);
      const data = JSON.parse(await fs.readFile(file, "utf-8"));
      const ids = data.providers.llmgateway.models.map((m: { id: string }) => m.id);
      expect(ids).toContain("a");
      expect(ids).toContain("b");
    } finally {
      await fs.rm(path.dirname(file), { recursive: true, force: true });
    }
  });

  it("remove lock órfão (stale) e prossegue", async () => {
    const file = await makeModelsJson();
    try {
      await fs.writeFile(`${file}.lock`, "stale");
      const past = new Date(Date.now() - 60_000);
      await fs.utimes(`${file}.lock`, past, past);
      const r = await registerModelInPiAgent({ modelId: "llmgateway/c", name: "C", pricing: { prompt: 0.5, completion: 0.6 } }, file);
      expect(r.ok).toBe(true);
      await expect(fs.access(`${file}.lock`)).rejects.toThrow();
    } finally {
      await fs.rm(path.dirname(file), { recursive: true, force: true });
    }
  });

  it("retorna erro quando o arquivo não existe", async () => {
    const r = await registerModelInPiAgent({ modelId: "x/y", name: "Y", pricing: null }, "/tmp/nao-existe-models.json");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Não foi possível ler");
  });
});
