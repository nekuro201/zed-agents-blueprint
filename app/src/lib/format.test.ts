import { describe, it, expect } from "vitest";
import { formatBytes, formatCost, formatDuration, formatTokens, formatRelativeTime } from "./format";

describe("format", () => {
  it("formata tokens (k acima de 1000, m acima de 1 milhão)", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(8400)).toBe("8.4k");
    expect(formatTokens(999_999)).toBe("1000.0k");
    expect(formatTokens(1_000_000)).toBe("1.0m");
    expect(formatTokens(1_656_500)).toBe("1.7m");
    expect(formatTokens(2_500_000)).toBe("2.5m");
  });

  it("formata custo com 4 casas", () => {
    expect(formatCost(0.5)).toBe("US$ 0.5000");
    expect(formatCost(1.7)).toBe("US$ 1.7000");
  });

  it("formata duração (ms) como HH:MM:SS", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(75_000)).toBe("00:01:15");
    expect(formatDuration(3_661_000)).toBe("01:01:01");
  });

  it("formata bytes em KB/MB/GB (indicador de memória)", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 ** 2)).toBe("5 MB");
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.50 GB");
    expect(formatBytes(8 * 1024 ** 3)).toBe("8.00 GB");
  });

  it("formatBytes degrada para — em valores inválidos", () => {
    expect(formatBytes(Number.NaN)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
  });

  it("formata tempo relativo", () => {
    const now = 1_000_000_000;
    expect(formatRelativeTime(now - 30_000, now)).toBe("30s atrás");
    expect(formatRelativeTime(now - 60_000, now)).toBe("1min atrás");
    expect(formatRelativeTime(now - 600_000, now)).toBe("10min atrás");
    expect(formatRelativeTime(now - 3600_000, now)).toBe("1h atrás");
    expect(formatRelativeTime(now - 7200_000, now)).toBe("2h atrás");
    expect(formatRelativeTime(now - 86400_000, now)).toBe("1d atrás");
    expect(formatRelativeTime(now - 172_800_000, now)).toBe("2d atrás");
  });
});
