import { describe, it, expect } from "vitest";
import {
  MEMORY_ALERT_BYTES,
  MEMORY_WARN_BYTES,
  memoryBreakdown,
  memoryLevel,
  memoryTotal,
} from "./memory";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

describe("memoryTotal", () => {
  it("soma os RSS medidos", () => {
    expect(memoryTotal({ app: 100, webview: 200, engine: 300 })).toBe(600);
  });

  it("ignora campos não medidos (null)", () => {
    expect(memoryTotal({ app: null, webview: 500, engine: null })).toBe(500);
  });

  it("sem medição alguma → null", () => {
    expect(memoryTotal({ app: null, webview: null, engine: null })).toBeNull();
    expect(memoryTotal(null)).toBeNull();
  });
});

describe("memoryLevel", () => {
  it("abaixo de 2GB → ok", () => {
    expect(memoryLevel(0)).toBe("ok");
    expect(memoryLevel(GB)).toBe("ok");
    expect(memoryLevel(MEMORY_WARN_BYTES - 1)).toBe("ok");
  });

  it("≥2GB → warn e ≥4GB → alert", () => {
    expect(memoryLevel(MEMORY_WARN_BYTES)).toBe("warn");
    expect(memoryLevel(MEMORY_ALERT_BYTES - 1)).toBe("warn");
    expect(memoryLevel(MEMORY_ALERT_BYTES)).toBe("alert");
    expect(memoryLevel(8 * GB)).toBe("alert");
  });

  it("sem medição → ok", () => {
    expect(memoryLevel(null)).toBe("ok");
  });
});

describe("memoryBreakdown", () => {
  it("detalha por processo e marca o que não foi medido", () => {
    const text = memoryBreakdown({ app: null, webview: 1.5 * GB, engine: 256 * MB });
    expect(text).toContain("UI: 1.50 GB");
    expect(text).toContain("Motor: 256 MB");
    expect(text).toContain("App: —");
  });
});
