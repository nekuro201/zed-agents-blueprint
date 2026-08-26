import { describe, it, expect } from "vitest";
import { calculateCostFromPricing } from "./cost";

/**
 * Fase 3.1 — helper de custo em memória (E10).
 */

describe("calculateCostFromPricing", () => {
  it("1M tokens de input a $0.28/Mtok → $0.28", () => {
    const cost = calculateCostFromPricing(
      { input: 1_000_000, output: 0 },
      { prompt: 0.28, completion: 0.42 },
    );
    expect(cost).toBeCloseTo(0.28);
  });

  it("500k tokens de output a $0.42/Mtok → $0.21", () => {
    const cost = calculateCostFromPricing(
      { input: 0, output: 500_000 },
      { prompt: 0.28, completion: 0.42 },
    );
    expect(cost).toBeCloseTo(0.21);
  });

  it("input + output combinados → soma", () => {
    const cost = calculateCostFromPricing(
      { input: 1_000_000, output: 500_000 },
      { prompt: 0.28, completion: 0.42 },
    );
    expect(cost).toBeCloseTo(0.49);
  });

  it("sem input nem output → 0", () => {
    expect(calculateCostFromPricing({ input: 0, output: 0 }, { prompt: 0.28, completion: 0.42 })).toBe(0);
  });

  it("valores fracionários de tokens", () => {
    const cost = calculateCostFromPricing(
      { input: 42, output: 137 },
      { prompt: 0.28, completion: 0.42 },
    );
    // (42 / 1_000_000) * 0.28 + (137 / 1_000_000) * 0.42
    const expected = (42 / 1_000_000) * 0.28 + (137 / 1_000_000) * 0.42;
    expect(cost).toBeCloseTo(expected);
  });
});
