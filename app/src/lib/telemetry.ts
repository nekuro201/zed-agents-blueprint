import type { AgentRole } from "./protocol";
import type { TimelineItem } from "../hooks/useEngine";

/**
 * Telemetria agregada por papel (E4 — Fase 1).
 *
 * A agregação é derivada da timeline (fonte única) por uma função pura, limitada
 * ao nº fixo de papéis (`AgentRole`) — o estado nunca cresce com o nº de eventos.
 */

export type Telemetry = {
  tokens: { input: number; output: number; total: number };
  cost: number;
  durationMs: number;
};

export type PerAgentTelemetry = Record<AgentRole, Telemetry>;

/** Ordem canônica dos 7 papéis (mesma taxonomia de `AgentRole`). */
export const AGENT_ROLES: readonly AgentRole[] = [
  "planejador",
  "leitor",
  "techlead",
  "coder",
  "testador",
  "qa",
  "crise",
];

const zero = (): Telemetry => ({
  tokens: { input: 0, output: 0, total: 0 },
  cost: 0,
  durationMs: 0,
});

export function emptyTelemetry(): PerAgentTelemetry {
  const acc = {} as PerAgentTelemetry;
  for (const role of AGENT_ROLES) acc[role] = zero();
  return acc;
}

export function aggregateTelemetry(timeline: TimelineItem[]): PerAgentTelemetry {
  const acc = emptyTelemetry();
  for (const item of timeline) {
    if (item.kind !== "agent") continue;
    const t = acc[item.role];
    if (item.stats) {
      t.tokens.input += item.stats.tokens.input;
      t.tokens.output += item.stats.tokens.output;
      t.tokens.total += item.stats.tokens.total;
      t.cost += item.stats.cost;
    }
    if (item.durationMs !== undefined) {
      t.durationMs += item.durationMs;
    }
  }
  return acc;
}
