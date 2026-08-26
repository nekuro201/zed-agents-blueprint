import { describe, it, expect, beforeEach } from "vitest";
import { createGate, triggerCrisisAccept, triggerCrisisRevert } from "./orchestrator";

/**
 * T3 (Fase 4 — E4): máquina de estados da crise.
 *
 * Testa que:
 * - O Gate tem `crisisWaiters` inicializado vazio.
 * - `triggerCrisisAccept` resolve os waiters com "accept".
 * - `triggerCrisisRevert` resolve os waiters com "revert".
 * - O padrão de espera funciona como Promise (orchestrator bloqueia até accept/revert).
 */

describe("Gate — crisisWaiters (Fase 4)", () => {
  let gate: ReturnType<typeof createGate>;

  beforeEach(() => {
    gate = createGate();
  });

  it("gate começa com crisisWaiters vazio", () => {
    expect(gate.crisisWaiters).toEqual([]);
  });

  it("triggerCrisisAccept resolve os waiters com 'accept'", async () => {
    const promise = new Promise<"accept" | "revert">((resolve) => {
      gate.crisisWaiters.push(resolve);
    });
    // Dispara o accept em paralelo
    setTimeout(() => triggerCrisisAccept(gate), 5);
    const result = await promise;
    expect(result).toBe("accept");
    // Waiters foram consumidos
    expect(gate.crisisWaiters).toHaveLength(0);
  });

  it("triggerCrisisRevert resolve os waiters com 'revert'", async () => {
    const promise = new Promise<"accept" | "revert">((resolve) => {
      gate.crisisWaiters.push(resolve);
    });
    setTimeout(() => triggerCrisisRevert(gate), 5);
    const result = await promise;
    expect(result).toBe("revert");
    expect(gate.crisisWaiters).toHaveLength(0);
  });

  it("múltiplos waiters são todos resolvidos", async () => {
    const results: Array<"accept" | "revert"> = [];
    const p1 = new Promise<"accept" | "revert">((r) => gate.crisisWaiters.push(r)).then((v) => results.push(v));
    const p2 = new Promise<"accept" | "revert">((r) => gate.crisisWaiters.push(r)).then((v) => results.push(v));
    setTimeout(() => triggerCrisisAccept(gate), 5);
    await Promise.all([p1, p2]);
    expect(results).toEqual(["accept", "accept"]);
  });

  it("crisisWaiters é independente de resumeWaiters", () => {
    const crisisResults: string[] = [];
    // Adiciona um waiter de crise
    gate.crisisWaiters.push((action) => crisisResults.push(action));
    // Dispara accept
    triggerCrisisAccept(gate);
    expect(crisisResults).toEqual(["accept"]);
    // resumeWaiters continua vazio (não foi afetado)
    expect(gate.resumeWaiters).toEqual([]);
  });
});
