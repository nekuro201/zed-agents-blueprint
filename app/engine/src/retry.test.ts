import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry, isTransientError } from "./retry.js";
import { StopSignal } from "./orchestrator.js";

/**
 * T2 RED — Testes do withRetry (engine, E4 Fase 2).
 * Este arquivo existe ANTES do módulo retry.ts — deve falhar (módulo ausente)
 * na primeira execução, validando a fase RED.
 */
describe("isTransientError", () => {
  it("classifica erros de rede como transitórios", () => {
    expect(isTransientError(new Error("ECONNREFUSED"))).toBe(true);
    expect(isTransientError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isTransientError(new Error("ENOTFOUND example.com"))).toBe(true);
    expect(isTransientError(new Error("network error"))).toBe(true);
    expect(isTransientError(new Error("fetch failed"))).toBe(true);
  });

  it("classifica HTTP 5xx como transitório", () => {
    expect(isTransientError(new Error("HTTP 500"))).toBe(true);
    expect(isTransientError(new Error("status 503"))).toBe(true);
    expect(isTransientError(new Error("got 502 Bad Gateway"))).toBe(true);
  });

  it("NÃO classifica erro de tipo/runtime como transitório", () => {
    expect(isTransientError(new Error("TypeError: foo is not a function"))).toBe(false);
    expect(isTransientError(new Error("ReferenceError: x is not defined"))).toBe(false);
    expect(isTransientError(new Error("something else"))).toBe(false);
  });

  it("NÃO classifica StopSignal como transitório", () => {
    expect(isTransientError(new StopSignal())).toBe(false);
  });

  it("NÃO classifica valores não-Error como transitório", () => {
    expect(isTransientError("string error")).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError(42)).toBe(false);
  });
});

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const flushTimers = async () => {
    await vi.runAllTimersAsync();
  };

  it("sucesso na primeira tentativa — zero chamadas de onRetry", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockResolvedValue("ok");

    const promise = withRetry(fn, { role: "coder", onRetry });
    await flushTimers();
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("falha transitória → retry → sucesso", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { role: "techlead", onRetry });
    await flushTimers();
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ role: "techlead", attempt: 1, reason: expect.stringContaining("ECONNREFUSED") }),
    );
    expect(onRetry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ role: "techlead", attempt: 2, reason: expect.stringContaining("ETIMEDOUT") }),
    );
    // delayMs deve ser > 0
    expect(onRetry.mock.calls[0]![0].delayMs).toBeGreaterThan(0);
  });

  it("erro não-transitório re-lança imediatamente sem retry", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error("TypeError: something"));

    const promise = withRetry(fn, { role: "coder", onRetry });
    const assertion = expect(promise).rejects.toThrow("TypeError: something");
    await flushTimers();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("estoura maxAttempts e re-lança o último erro", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"));

    const promise = withRetry(fn, { role: "coder", maxAttempts: 3, onRetry });
    const assertion = expect(promise).rejects.toThrow("ETIMEDOUT");
    await flushTimers();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
    // Última tentativa não chama onRetry (não há backoff após a última falha)
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("signal.aborted durante o backoff lança StopSignal", async () => {
    const onRetry = vi.fn();
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const promise = withRetry(fn, { role: "coder", signal: controller.signal, onRetry });
    const assertion = expect(promise).rejects.toThrow(StopSignal);

    // Avança os timers o suficiente para a primeira tentativa falhar e agendar o retry
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // Aborta durante o backoff — a promise deve rejeitar com StopSignal
    controller.abort();

    // Consome todos os timers pendentes e espera a rejeição
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("signal já abortado no início lança StopSignal imediatamente", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn();

    const promise = withRetry(fn, { role: "coder", signal: controller.signal });
    const assertion = expect(promise).rejects.toThrow(StopSignal);
    await flushTimers();
    await assertion;
    expect(fn).not.toHaveBeenCalled();
  });
});
