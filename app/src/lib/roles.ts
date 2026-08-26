import type { AgentRole } from "./protocol";

/**
 * Rótulos e cores dos papéis de agente — fonte única (DRY).
 * Usados pelo terminal do loop (LoopTerminal) e pelo resumo de telemetria
 * por papel (LoopTop, E4 — Fase 1). Ordem/taxonomia de `AgentRole`.
 */
export const ROLE_LABEL: Record<AgentRole, string> = {
  planejador: "Planejador",
  leitor: "Leitor",
  techlead: "Techlead",
  coder: "Coder",
  testador: "Testador",
  qa: "Juiz TDD",
  crise: "Crise",
};

export const ROLE_COLOR: Record<AgentRole, string> = {
  planejador: "text-indigo-400",
  leitor: "text-violet-400",
  techlead: "text-sky-400",
  coder: "text-emerald-400",
  testador: "text-cyan-400",
  qa: "text-fuchsia-400",
  crise: "text-red-400",
};
