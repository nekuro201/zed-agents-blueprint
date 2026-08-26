import { describe, it, expect } from "vitest";
import { aggregateTelemetry, emptyTelemetry } from "./telemetry";
import type { AgentRole } from "./protocol";
import type { TimelineItem } from "../hooks/useEngine";

const ROLES: AgentRole[] = ["planejador", "leitor", "techlead", "coder", "testador", "qa", "crise"];

const stats = (input: number, output: number, cost: number) => ({
  tokens: { input, output, total: input + output },
  cost,
});

function agent(id: number, role: AgentRole, opts?: { input?: number; output?: number; cost?: number; durationMs?: number }): TimelineItem {
  const hasStats = opts !== undefined && (opts.input !== undefined || opts.output !== undefined || opts.cost !== undefined);
  return {
    id,
    kind: "agent",
    role,
    ended: true,
    thinking: "",
    text: "",
    tools: [],
    ...(hasStats ? { stats: stats(opts.input ?? 0, opts.output ?? 0, opts.cost ?? 0) } : {}),
    ...(opts?.durationMs !== undefined ? { durationMs: opts.durationMs } : {}),
  };
}

describe("telemetry (E4 Fase 1)", () => {
  it("emptyTelemetry retorna as 7 chaves de AgentRole zeradas", () => {
    const empty = emptyTelemetry();
    expect(Object.keys(empty).sort()).toEqual([...ROLES].sort());
    for (const role of ROLES) {
      expect(empty[role]).toEqual({ tokens: { input: 0, output: 0, total: 0 }, cost: 0, durationMs: 0 });
    }
  });

  it("aggregateTelemetry soma por papel e separa papéis diferentes", () => {
    const tl: TimelineItem[] = [
      agent(1, "coder", { input: 100, output: 50, cost: 0.5, durationMs: 1000 }),
      agent(2, "coder", { input: 200, output: 0, cost: 0.5, durationMs: 500 }),
      agent(3, "qa", { input: 10, output: 10, cost: 0.1, durationMs: 300 }),
    ];
    const agg = aggregateTelemetry(tl);
    expect(agg.coder).toEqual({ tokens: { input: 300, output: 50, total: 350 }, cost: 1, durationMs: 1500 });
    expect(agg.qa).toEqual({ tokens: { input: 10, output: 10, total: 20 }, cost: 0.1, durationMs: 300 });
    expect(agg.techlead).toEqual({ tokens: { input: 0, output: 0, total: 0 }, cost: 0, durationMs: 0 });
  });

  it("ignora itens não-agente e agentes sem stats/durationMs", () => {
    const tl: TimelineItem[] = [
      { id: 1, kind: "log", level: "info", message: "x" },
      { id: 2, kind: "phase", fase: "Fase 1", order: 0 },
      agent(3, "coder"),
    ];
    const agg = aggregateTelemetry(tl);
    expect(agg.coder).toEqual({ tokens: { input: 0, output: 0, total: 0 }, cost: 0, durationMs: 0 });
  });
});
