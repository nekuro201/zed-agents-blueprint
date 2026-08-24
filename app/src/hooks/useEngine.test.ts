import { describe, it, expect } from "vitest";
import { reducer, initialState } from "./useEngine";
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

  it("zera os contadores quando um novo loop inicia (status starting)", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    s = apply(s, { type: "agent-end", role: "coder", stats: { tokens: { input: 100, output: 10, total: 110 }, cost: 1 } });
    expect(s.tokens.total).toBe(110);
    s = apply(s, { type: "status", status: "starting" });
    expect(s.tokens).toEqual({ input: 0, output: 0, total: 0 });
    expect(s.cost).toBe(0);
    expect(s.elapsed).toBe(0);
  });

  it("só incrementa elapsed com a ação tick e apenas enquanto roda/started", () => {
    let s = apply(initialState, { type: "status", status: "running" });
    expect(reducer(s, { type: "tick" }).elapsed).toBe(1);
    const paused = apply(s, { type: "status", status: "waiting" });
    expect(reducer(paused, { type: "tick" }).elapsed).toBe(0);
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
