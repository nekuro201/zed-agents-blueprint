import type { LucideIcon } from "lucide-react";
import { Brain, ClipboardList, Code2, Scale } from "lucide-react";

/**
 * Agentes do fluxo — fonte única de chaves, rótulos e ícones (DRY).
 * Usada pelo roster (Sidebar), pela persistência de modelos (modelConfig) e,
 * futuramente, pelo pipeline/terminal ligados ao engine.
 */
export const AGENT_KEYS = ["plan", "techlead", "coder", "qa"] as const;

export type AgentKey = (typeof AGENT_KEYS)[number];

export interface AgentMeta {
  label: string;
  icon: LucideIcon;
  defaultModel: string;
  defaultThinking: string;
}

export const AGENT_META: Record<AgentKey, AgentMeta> = {
  plan: { label: "Planejador", icon: Brain, defaultModel: "llmgateway/deepseek-v4-flash", defaultThinking: "Standard" },
  techlead: { label: "Techlead", icon: ClipboardList, defaultModel: "llmgateway/deepseek-v4-flash", defaultThinking: "Standard" },
  coder: { label: "Coder", icon: Code2, defaultModel: "llmgateway/deepseek-v4-flash", defaultThinking: "Standard" },
  qa: { label: "Juiz TDD", icon: Scale, defaultModel: "llmgateway/grok-4-5", defaultThinking: "Maximum" },
};
