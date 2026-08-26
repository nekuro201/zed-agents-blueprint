import type { AgentRole } from "./protocol";

/**
 * Agentes configuráveis no modal de modelos — fonte única de ORDEM e DEFAULTS.
 * Os rótulos ficam em `roles.ts` (ROLE_LABEL) e os ícones no `pipeline.ts`
 * (ROLE_ICON) — nada de duplicar essa taxonomia aqui.
 */
export const AGENT_KEYS: readonly AgentRole[] = [
  "planejador",
  "leitor",
  "techlead",
  "coder",
  "testador",
  "qa",
  "crise",
];

export type AgentKey = AgentRole;

export interface AgentMeta {
  defaultModel: string;
  defaultThinking: string;
}

export const AGENT_META: Record<AgentRole, AgentMeta> = {
  planejador: { defaultModel: "llmgateway/deepseek-v4-flash", defaultThinking: "Standard" },
  leitor: { defaultModel: "llmgateway/deepseek-v4-flash", defaultThinking: "Standard" },
  techlead: { defaultModel: "llmgateway/deepseek-v4-flash", defaultThinking: "Standard" },
  coder: { defaultModel: "llmgateway/deepseek-v4-flash", defaultThinking: "Standard" },
  testador: { defaultModel: "llmgateway/deepseek-v4-flash", defaultThinking: "Standard" },
  qa: { defaultModel: "llmgateway/deepseek-v4-flash", defaultThinking: "Maximum" },
  crise: { defaultModel: "llmgateway/deepseek-v4-flash", defaultThinking: "Medium" },
};
