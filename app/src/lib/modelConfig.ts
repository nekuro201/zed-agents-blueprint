import { z } from "zod";
import { AGENT_KEYS, AGENT_META, type AgentKey } from "./agents";

/**
 * Configuração de modelo/thinking por agente — CAMPO MANUAL (sem dropdown,
 * decisão do ESCOPO/AGENTS). Persiste validado com Zod no localStorage.
 */
export interface AgentConfigEntry {
  model: string;
  thinking: string;
}

export type AgentModelConfig = Record<AgentKey, AgentConfigEntry>;

const entry = z.object({
  model: z.string().min(1, "Modelo não pode ser vazio"),
  thinking: z.string().min(1, "Thinking não pode ser vazio"),
});

// Espelho explícito das 7 chaves do `AgentModels` (protocolo), nunca um
// `Object.fromEntries` que apagaria os tipos literais para o Zod.
export const AGENT_CONFIG_SCHEMA = z.object({
  planejador: entry,
  leitor: entry,
  techlead: entry,
  coder: entry,
  testador: entry,
  qa: entry,
  crise: entry,
});

export const STORAGE_KEY = "pi-factory:model-config";

/** Defaults derivados do AGENT_META (fonte única — DRY). */
export const DEFAULT_MODEL_CONFIG: AgentModelConfig = Object.fromEntries(
  AGENT_KEYS.map((key) => [
    key,
    { model: AGENT_META[key].defaultModel, thinking: AGENT_META[key].defaultThinking },
  ]),
) as AgentModelConfig;

export function loadModelConfig(): AgentModelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MODEL_CONFIG;
    return AGENT_CONFIG_SCHEMA.parse(JSON.parse(raw));
  } catch {
    // Dado corrompido ou fora do schema → volta ao default (nunca quebra a app).
    return DEFAULT_MODEL_CONFIG;
  }
}

export function saveModelConfig(config: AgentModelConfig): void {
  const validated = AGENT_CONFIG_SCHEMA.parse(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
}
