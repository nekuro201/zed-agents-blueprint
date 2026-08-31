import { describe, it, expect } from "vitest";
import { buildPlanInstruction } from "./orchestrator";

/**
 * E5/Fase C — chat do Planejador com contexto entre turnos.
 *
 * `buildPlanInstruction` monta a instrução enviada ao modelo `planejador`.
 * Turnos anteriores entram como "CONTEXTO"; o alvo é sempre o PEDIDO (última
 * mensagem). Sem histórico, o comportamento é idêntico ao anterior.
 */

describe("buildPlanInstruction (Planejador — contexto de conversa)", () => {
  it("sem histórico usa só o PEDIDO (sem bloco de contexto)", () => {
    const out = buildPlanInstruction("Criar app de tarefas");
    expect(out).toContain("PEDIDO:\nCriar app de tarefas");
    expect(out).not.toContain("CONTEXTO DA CONVERSA");
  });

  it("histórico vazio é tratado como sem histórico", () => {
    const out = buildPlanInstruction("Prompt", []);
    expect(out).not.toContain("CONTEXTO DA CONVERSA");
  });

  it("com histórico inclui turnos anteriores como contexto e o pedido separado", () => {
    const out = buildPlanInstruction("Quero autenticação JWT", [
      { role: "user", text: "Criar app de tarefas" },
      { role: "planner", text: "Qual tipo de autenticação você prefere?" },
    ]);
    expect(out).toContain("CONTEXTO DA CONVERSA");
    expect(out).toContain("Usuário: Criar app de tarefas");
    expect(out).toContain("Planejador: Qual tipo de autenticação você prefere?");
    expect(out).toContain("PEDIDO (última mensagem do usuário):\nQuero autenticação JWT");
  });

  it("preserva a ordem dos turnos no contexto", () => {
    const out = buildPlanInstruction("P3", [
      { role: "user", text: "P1" },
      { role: "planner", text: "R1" },
      { role: "user", text: "P2" },
    ]);
    const iUserP1 = out.indexOf("Usuário: P1");
    const iPlanner = out.indexOf("Planejador: R1");
    const iUserP2 = out.indexOf("Usuário: P2");
    expect(iUserP1).toBeGreaterThanOrEqual(0);
    expect(iPlanner).toBeGreaterThan(iUserP1);
    expect(iUserP2).toBeGreaterThan(iPlanner);
  });
});
