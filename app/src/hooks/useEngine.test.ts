import { describe, it, expect, beforeEach } from "vitest";
import { reducer, initialState, loadUsageTotals, saveUsageTotals, MAX_AGENT_TEXT, MAX_AGENT_TOOLS } from "./useEngine";
import type { EngineEvent } from "../lib/protocol";

type S = ReturnType<typeof reducer>;

function apply(s: S, ev: EngineEvent): S {
  return reducer(s, { type: "event", ev });
}

describe("reducer 2.2.3 — acumuladores e timer", () => {
  it("contadores começam zerados", () => {
    expect(initialState.elapsed).toBe(0);
    expect(initialState.tokens).toEqual({ input: 0, output: 0, total: 0 });
    expect(initialState.cost).toBe(0);
  });

  it("acumula tokens e custo a cada agent-end", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    s = apply(s, { type: "agent-end", role: "techlead", stats: { tokens: { input: 100, output: 50, total: 150 }, cost: 0.5 } });
    s = apply(s, { type: "agent-end", role: "coder", stats: { tokens: { input: 200, output: 0, total: 200 }, cost: 1.2 } });
    expect(s.tokens).toEqual({ input: 300, output: 50, total: 350 });
    expect(s.cost).toBeCloseTo(1.7);
  });

  it("não zera tokens/custo ao iniciar novo loop (acumula por sessão)", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    s = apply(s, { type: "agent-end", role: "coder", stats: { tokens: { input: 100, output: 10, total: 110 }, cost: 1 } });
    expect(s.tokens.total).toBe(110);
    expect(s.cost).toBeCloseTo(1);
    s = apply(s, { type: "status", status: "starting" });
    expect(s.tokens.total).toBe(110);
    expect(s.cost).toBeCloseTo(1);
    expect(s.elapsed).toBe(0);
    expect(s.completed).toBe(false);
  });

  it("só incrementa elapsed com a ação tick e apenas enquanto roda/started", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    expect(reducer(s, { type: "tick" }).elapsed).toBe(1);
    const paused = apply(s, { type: "status", status: "waiting" });
    expect(reducer(paused, { type: "tick" }).elapsed).toBe(0);
  });
});

describe("persistência de uso (tokens/custo por workspace)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadUsageTotals retorna zeros quando nada foi salvo", () => {
    expect(loadUsageTotals("/proj")).toEqual({ tokens: { input: 0, output: 0, total: 0 }, cost: 0 });
  });

  it("salva e recarrega os totais de um workspace (round-trip)", () => {
    saveUsageTotals("/proj", { tokens: { input: 100, output: 50, total: 150 }, cost: 1.7 });
    expect(loadUsageTotals("/proj")).toEqual({ tokens: { input: 100, output: 50, total: 150 }, cost: 1.7 });
  });

  it("mantém totais separados por workspace", () => {
    saveUsageTotals("/a", { tokens: { input: 10, output: 0, total: 10 }, cost: 0.1 });
    saveUsageTotals("/b", { tokens: { input: 999, output: 999, total: 1998 }, cost: 9.9 });
    expect(loadUsageTotals("/a").tokens.total).toBe(10);
    expect(loadUsageTotals("/b").tokens.total).toBe(1998);
    expect(loadUsageTotals("/a").cost).toBeCloseTo(0.1);
    expect(loadUsageTotals("/b").cost).toBeCloseTo(9.9);
  });

  it("volta para zeros se o dado salvo for corrompido", () => {
    localStorage.setItem("pi-factory:usage-totals", "{ não é json");
    expect(loadUsageTotals("/proj")).toEqual({ tokens: { input: 0, output: 0, total: 0 }, cost: 0 });
  });
});

describe("reducer F2 — planning", () => {
  it("começa com planning=false", () => {
    expect(initialState.planning).toBe(false);
  });

  it("status starting com detail de PLAN.md liga planning", () => {
    const s = apply(initialState, { type: "status", status: "starting", detail: "Planejador gerando o PLAN.md…" });
    expect(s.planning).toBe(true);
  });

  it("plan-done desliga planning", () => {
    let s = apply(initialState, { type: "status", status: "starting", detail: "Planejador gerando o PLAN.md…" });
    expect(s.planning).toBe(true);
    s = apply(s, { type: "plan-done", projectDir: "/tmp/proj" });
    expect(s.planning).toBe(false);
  });
});

describe("reducer — completed (trava de segurança)", () => {
  it("done (todas as fases concluídas) marca completed=true", () => {
    const s = apply(initialState, { type: "done", message: "🎉 Todas as fases do PLAN.md estão concluídas." });
    expect(s.completed).toBe(true);
  });

  it("um novo loop (status starting) reseta completed=false", () => {
    let s = apply(initialState, { type: "done", message: "🎉 Concluído." });
    expect(s.completed).toBe(true);
    s = apply(s, { type: "status", status: "starting" });
    expect(s.completed).toBe(false);
  });

  it("gerar novo plano (plan-done) reseta completed=false", () => {
    let s = apply(initialState, { type: "done", message: "🎉 Concluído." });
    expect(s.completed).toBe(true);
    s = apply(s, { type: "plan-done", projectDir: "/tmp/proj" });
    expect(s.completed).toBe(false);
  });
});

describe("reducer E3 — status do grafo", () => {
  it("começa sem grafo (empty)", () => {
    expect(initialState.graphStatus).toBe("empty");
    expect(initialState.graphError).toBeNull();
  });

  it("graph-start liga o estado de geração (loading)", () => {
    const s = apply(initialState, { type: "graph-start", projectDir: "/tmp/proj" });
    expect(s.graphStatus).toBe("loading");
  });

  it("graph-ready marca como pronto", () => {
    let s = apply(initialState, { type: "graph-start", projectDir: "/tmp/proj" });
    s = apply(s, { type: "graph-ready", projectDir: "/tmp/proj", reportPath: "/tmp/proj/graphify-out/GRAPH_REPORT.md" });
    expect(s.graphStatus).toBe("ready");
    expect(s.graphError).toBeNull();
  });

  it("graph-error volta para empty e registra o motivo", () => {
    let s = apply(initialState, { type: "graph-start", projectDir: "/tmp/proj" });
    s = apply(s, { type: "graph-error", message: "Falha ao gerar o grafo: not-installed." });
    expect(s.graphStatus).toBe("empty");
    expect(s.graphError).toBe("Falha ao gerar o grafo: not-installed.");
  });
});

describe("reducer 2.2.4 — cap de conteúdo dos cards de agente", () => {
  it("texto do card é truncado no teto, mantendo a cauda e marcando capped", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    s = apply(s, { type: "agent-start", role: "coder", model: "m" });
    s = apply(s, { type: "token", role: "coder", delta: "x".repeat(MAX_AGENT_TEXT + 500) });
    const card = s.timeline.find((it) => it.kind === "agent");
    expect(card).toMatchObject({ kind: "agent", capped: true });
    if (card?.kind === "agent") {
      expect(card.text.length).toBe(MAX_AGENT_TEXT);
      expect(card.text).toBe("x".repeat(MAX_AGENT_TEXT));
    }
  });

  it("thinking do card é truncado no teto, mantendo a cauda e marcando capped", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    s = apply(s, { type: "agent-start", role: "techlead", model: "m" });
    s = apply(s, { type: "thinking", role: "techlead", delta: "y".repeat(MAX_AGENT_TEXT + 100) });
    const card = s.timeline.find((it) => it.kind === "agent");
    expect(card).toMatchObject({ kind: "agent", capped: true });
    if (card?.kind === "agent") expect(card.thinking.length).toBe(MAX_AGENT_TEXT);
  });

  it("não marca capped enquanto o conteúdo fica abaixo do teto", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    s = apply(s, { type: "agent-start", role: "coder", model: "m" });
    s = apply(s, { type: "token", role: "coder", delta: "abc" });
    const card = s.timeline.find((it) => it.kind === "agent");
    expect(card).toMatchObject({ kind: "agent", capped: false });
  });

  it("tools são limitadas ao teto, descartando a mais antiga", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    s = apply(s, { type: "agent-start", role: "coder", model: "m" });
    for (let i = 0; i < MAX_AGENT_TOOLS + 25; i++) {
      s = apply(s, { type: "tool-call", role: "coder", tool: "edit", args: `f${i}` });
    }
    const card = s.timeline.find((it) => it.kind === "agent");
    if (card?.kind === "agent") {
      expect(card.tools.length).toBe(MAX_AGENT_TOOLS);
      expect(card.tools[0]?.args).toBe(`f${25}`);
      expect(card.tools[card.tools.length - 1]?.args).toBe(`f${MAX_AGENT_TOOLS + 24}`);
      expect(card.capped).toBe(true);
    }
  });
});

describe("reducer E4 Fase 1 — telemetria (durationMs)", () => {
  it("contador de duração começa zerado", () => {
    expect(initialState.durationMs).toBe(0);
  });

  it("acumula durationMs global a cada agent-end", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    s = apply(s, { type: "agent-end", role: "techlead", stats: { tokens: { input: 1, output: 1, total: 2 }, cost: 0.1 }, durationMs: 4200 });
    s = apply(s, { type: "agent-end", role: "coder", stats: { tokens: { input: 1, output: 1, total: 2 }, cost: 0.1 }, durationMs: 1800 });
    expect(s.durationMs).toBe(6000);
  });

  it("retém durationMs no card de agente da timeline", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    s = apply(s, { type: "agent-start", role: "coder", model: "llmgateway/deepseek-v4-flash" });
    s = apply(s, { type: "agent-end", role: "coder", stats: { tokens: { input: 1, output: 1, total: 2 }, cost: 0.1 }, durationMs: 950 });
    const card = s.timeline.find((it) => it.kind === "agent");
    expect(card).toMatchObject({ kind: "agent", role: "coder", ended: true, durationMs: 950 });
  });

  it("zera durationMs quando um novo loop inicia (status starting)", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    s = apply(s, { type: "agent-end", role: "coder", stats: { tokens: { input: 1, output: 1, total: 2 }, cost: 0.1 }, durationMs: 1500 });
    expect(s.durationMs).toBe(1500);
    s = apply(s, { type: "status", status: "starting" });
    expect(s.durationMs).toBe(0);
  });
});
