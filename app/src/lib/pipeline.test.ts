import { describe, it, expect } from "vitest";
import { pipelineFromTimeline } from "./pipeline";
import type { TimelineItem } from "../hooks/useEngine";
import type { AgentRole } from "./protocol";

/**
 * O pipeline do loop agora deriva 1:1 do `AgentRole` (6 papéis), SEM o
 * Planejador — que roda apenas na geração do PLAN.md, fora do loop.
 */

const ROLE_ORDER = ["leitor", "techlead", "coder", "testador", "qa", "crise"] as const;

function agent(role: AgentRole, ended: boolean): TimelineItem {
  return { id: 1, kind: "agent", role, ended, thinking: "", text: "", tools: [] };
}

describe("pipelineFromTimeline (6 papéis, sem Planejador)", () => {
  it("sem timeline: 6 agentes idle, na ordem canônica", () => {
    const agents = pipelineFromTimeline([]);
    expect(agents.map((a) => a.id)).toEqual([...ROLE_ORDER]);
    expect(agents.map((a) => a.status)).toEqual(["idle", "idle", "idle", "idle", "idle", "idle"]);
    expect(agents.map((a) => a.label)).toEqual(["Leitor", "Techlead", "Coder", "Testador", "Juiz TDD", "Crise"]);
  });

  it("techlead aberto: leitor done, techlead active, resto idle", () => {
    const tl: TimelineItem[] = [agent("techlead", false)];
    expect(pipelineFromTimeline(tl).map((a) => a.status)).toEqual(["done", "active", "idle", "idle", "idle", "idle"]);
  });

  it("techlead ended + coder aberto: coder active", () => {
    const tl: TimelineItem[] = [agent("techlead", true), agent("coder", false)];
    expect(pipelineFromTimeline(tl).map((a) => a.status)).toEqual(["done", "done", "active", "idle", "idle", "idle"]);
  });

  it("coder ended + testador aberto: testador active", () => {
    const tl: TimelineItem[] = [agent("coder", true), agent("testador", false)];
    expect(pipelineFromTimeline(tl).map((a) => a.status)).toEqual(["done", "done", "done", "active", "idle", "idle"]);
  });

  it("crise aberto: todos os anteriores done, crise active", () => {
    const tl: TimelineItem[] = [
      agent("leitor", true),
      agent("techlead", true),
      agent("coder", true),
      agent("testador", true),
      agent("qa", true),
      agent("crise", false),
    ];
    expect(pipelineFromTimeline(tl).map((a) => a.status)).toEqual(["done", "done", "done", "done", "done", "active"]);
  });

  it("evento do Planejador não aparece como card e não ativa o pipeline", () => {
    const tl: TimelineItem[] = [agent("planejador", false)];
    const agents = pipelineFromTimeline(tl);
    expect(agents.map((a) => a.id)).not.toContain("planejador");
    expect(agents.every((a) => a.status === "idle")).toBe(true);
  });
});
