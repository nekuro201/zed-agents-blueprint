import { describe, it, expect } from "vitest";
import { formatCost, formatTokens } from "./format";

describe("format", () => {
  it("formata tokens (k acima de 1000)", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(8400)).toBe("8.4k");
  });

  it("formata custo com 4 casas", () => {
    expect(formatCost(0.5)).toBe("US$ 0.5000");
    expect(formatCost(1.7)).toBe("US$ 1.7000");
  });
});
