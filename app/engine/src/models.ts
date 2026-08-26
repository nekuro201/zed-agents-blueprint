import { emit as emitEvent } from "./protocol.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

/**
 * Fetch + cache da lista de modelos da API pública do llmgateway (E10 — Fase 1).
 *
 * A API é pública (`GET /v1/models`, sem API key). O resultado fica em cache em
 * memória no engine (válido até o processo morrer). A UI pode enviar `models-list`
 * sob demanda, e o app dispara no boot.
 */

export interface LlmGatewayModel {
  id: string;
  name: string;
  provider: string;
  /** Preço em $/milhão de tokens. Null quando a API não reporta pricing. */
  pricing: { prompt: number; completion: number } | null;
  /** Níveis de reasoning suportados pelo provedor (ex.: ["low", "medium", "high"]). */
  reasoningEfforts?: string[];
}

// ── Parser da resposta da API ─────────────────────────────────────────────

interface ApiModelEntry {
  id?: string;
  name?: string;
  providers?: {
    providerId?: string;
    externalId?: string;
    pricing?: { prompt?: string; completion?: string };
    reasoningEfforts?: string[];
  }[];
  pricing?: { prompt?: string; completion?: string };
}

/**
 * Converte o valor de pricing da API (string em $/token) para $/milhão de tokens
 * (número, mesmo formato esperado pelo SDK `ModelCostRates`).
 *
 * Ex.: "0.00000028" → parseFloat("0.00000028") * 1_000_000 → 0.28
 */
function toPricePerMillion(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n * 1_000_000 : undefined;
}

export function parseModelsResponse(raw: { data?: unknown[] }): LlmGatewayModel[] {
  const result: LlmGatewayModel[] = [];
  const items = Array.isArray(raw?.data) ? raw.data : [];
  for (const item of items) {
    const entry = item as ApiModelEntry;
    if (!entry.id) continue;
    const providers = Array.isArray(entry.providers) ? entry.providers : [];
    if (providers.length === 0) continue;

    const firstProvider = providers[0];
    // A API é do gateway llmgateway. O `providerId`/`externalId` de `providers[]`
    // são o PROVEDOR UPSTREAM (ex.: "deepseek"), não o gateway. O `models.json`
    // do usuário usa o provider "llmgateway", então montamos `llmgateway/<modelId>`.
    const modelId = entry.id.includes("/") ? entry.id.split("/").pop() ?? entry.id : entry.id;
    const normalizedId = `${LLMGATEWAY_PROVIDER}/${modelId}`;

    // Provider pricing tem prioridade; fallback no top-level pricing.
    const src = (firstProvider?.pricing?.prompt !== undefined || firstProvider?.pricing?.completion !== undefined)
      ? firstProvider.pricing
      : entry.pricing;

    const prompt = toPricePerMillion(src?.prompt);
    const completion = toPricePerMillion(src?.completion);
    const pricing = (prompt !== undefined && completion !== undefined)
      ? { prompt, completion }
      : null;

    result.push({
      id: normalizedId,
      name: entry.name ?? modelId,
      provider: LLMGATEWAY_PROVIDER,
      pricing,
      reasoningEfforts: firstProvider?.reasoningEfforts,
    });
  }
  return result;
}

// ── Cache + fetch ─────────────────────────────────────────────────────────

const LLMGATEWAY_URL = "https://api.llmgateway.io/v1/models";
const FETCH_TIMEOUT_MS = 30_000;
/** Provider do gateway usado na referência `provider/model` (mesmo do models.json). */
const LLMGATEWAY_PROVIDER = "llmgateway";

let cachedModels: LlmGatewayModel[] | null = null;

function abortableFetch(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Busca a lista de modelos do llmgateway (com cache em memória). Nunca lança —
 * emite `models-list-result` com `ok: false` + `reason` em caso de erro.
 */
export async function fetchModelsList(): Promise<void> {
  if (cachedModels !== null) {
    emitEvent({ type: "models-list-result", models: cachedModels, ok: true });
    return;
  }

  try {
    const res = await abortableFetch(LLMGATEWAY_URL, FETCH_TIMEOUT_MS);
    if (!res.ok) {
      emitEvent({ type: "models-list-result", models: [], ok: false, reason: `HTTP ${res.status}: ${res.statusText}` });
      return;
    }
    const json = (await res.json()) as { data?: unknown[] };
    cachedModels = parseModelsResponse(json);
    emitEvent({ type: "models-list-result", models: cachedModels, ok: true });
  } catch (err) {
    emitEvent({ type: "models-list-result", models: [], ok: false, reason: (err as Error).message });
  }
}

/** Retorna o modelo (lista + ref) com match tolerante de provider/model. */
export function findModel(models: LlmGatewayModel[], modelRef: string): LlmGatewayModel | undefined {
  const [refProvider, refModelId] = modelRef.includes("/")
    ? [modelRef.split("/")[0], modelRef.split("/").slice(1).join("/")]
    : ["", modelRef];
  return models.find((m) => {
    if (m.id === modelRef) return true;
    const [mProvider, mModelId] = m.id.includes("/")
      ? [m.id.split("/")[0], m.id.split("/").slice(1).join("/")]
      : [m.provider, m.id];
    return mModelId === refModelId && (!refProvider || mProvider === refProvider);
  });
}

/** Retorna o pricing de um modelo conhecido (lista + ref). Null se não encontrado. */
export function findModelPricing(models: LlmGatewayModel[], modelRef: string): LlmGatewayModel["pricing"] {
  return findModel(models, modelRef)?.pricing ?? null;
}

/** Estado do pricing para um modelo (usado no feedback visual de custo). */
export type PricingStatus = "pricing" | "no-pricing" | "not-found" | "not-loaded";

/** Retorna o estado do pricing de um modelo no cache. */
export function getModelPricingStatus(modelRef: string): PricingStatus {
  if (!cachedModels) return "not-loaded";
  const found = findModel(cachedModels, modelRef);
  if (!found) return "not-found";
  return found.pricing ? "pricing" : "no-pricing";
}

/** Retorna o pricing de um modelo conhecido (cache). Null se não encontrado. */
export function getModelPricing(modelRef: string): LlmGatewayModel["pricing"] {
  if (!cachedModels) return null;
  return findModelPricing(cachedModels, modelRef);
}

// ── Registro no `~/.pi/agent/models.json` ─────────────────────────────────

const PI_AGENT_MODELS_JSON = path.join(os.homedir(), ".pi", "agent", "models.json");

// Lock de arquivo para evitar "lost update" quando múltiplos workspaces/loops
// registram modelos concorrentemente (E5: multi-thread). O arquivo de destino é
// lido-e-reescrito (read-modify-write); sem lock, duas escritas simultâneas
// poderiam sobrescrever uma à outra e perder uma das atualizações.
const LOCK_RETRY_MS = 40;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 10_000;

async function acquireFileLock(lockPath: string): Promise<() => Promise<void>> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.close();
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      // Lock existe: pode ser concorrente legítimo ou órfão (crash). Remove órfãos.
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.rm(lockPath, { force: true });
          continue;
        }
      } catch {
        continue; // lock sumiu — tenta de novo imediatamente
      }
      if (Date.now() > deadline) {
        throw new Error(`Timeout ao adquirir lock em ${lockPath}`);
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
  return async () => {
    await fs.rm(lockPath, { force: true });
  };
}

interface PiModelsJson {
  providers?: Record<string, { models?: PiModelEntry[]; [k: string]: unknown }>;
  [k: string]: unknown;
}

interface PiModelEntry {
  id: string;
  name?: string;
  reasoning?: boolean;
  cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  [k: string]: unknown;
}

/**
 * Adiciona/atualiza um modelo no `~/.pi/agent/models.json` (provider llmgateway),
 * com o `cost` convertido do pricing da API (prompt→input, completion→output,
 * cacheRead/cacheWrite=0). Merge não-destrutivo: preserva todos os campos e
 * faz backup `.bak` antes de escrever.
 */
export async function registerModelInPiAgent(
  input: {
    modelId: string;
    name: string;
    pricing: { prompt: number; completion: number } | null;
  },
  filePath: string = PI_AGENT_MODELS_JSON,
): Promise<{ ok: boolean; message: string }> {
  const lockPath = `${filePath}.lock`;
  let release: () => Promise<void>;
  try {
    release = await acquireFileLock(lockPath);
  } catch (err) {
    return { ok: false, message: `Não foi possível adquirir lock em ${filePath}: ${(err as Error).message}` };
  }

  try {
    const parts = input.modelId.includes("/") ? input.modelId.split("/") : [LLMGATEWAY_PROVIDER, input.modelId];
    const provider = parts[0];
    const modelId = parts.slice(1).join("/") || input.modelId;

    let data: PiModelsJson;
    try {
      data = JSON.parse(await fs.readFile(filePath, "utf-8")) as PiModelsJson;
    } catch (err) {
      return { ok: false, message: `Não foi possível ler ${filePath}: ${(err as Error).message}` };
    }

    data.providers ??= {};
    const prov = (data.providers[provider] ??= {});
    prov.models ??= [];
    const models = prov.models as PiModelEntry[];

    const existing = models.find((m) => m.id === modelId);
    const cost = input.pricing
      ? { input: input.pricing.prompt, output: input.pricing.completion, cacheRead: 0, cacheWrite: 0 }
      : undefined;

    if (existing) {
      existing.name = input.name;
      if (cost) existing.cost = cost;
      if (!existing.reasoning) existing.reasoning = true;
    } else {
      const entry: PiModelEntry = { id: modelId, name: input.name, reasoning: true };
      if (cost) entry.cost = cost;
      models.push(entry);
    }

    try {
      await fs.copyFile(filePath, `${filePath}.bak`);
    } catch {
      /* backup é best-effort */
    }

    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    } catch (err) {
      return { ok: false, message: `Falha ao escrever ${filePath}: ${(err as Error).message}` };
    }

    return { ok: true, message: `Modelo "${input.modelId}" registrado em ~/.pi/agent/models.json (provider ${provider}).` };
  } finally {
    await release();
  }
}
