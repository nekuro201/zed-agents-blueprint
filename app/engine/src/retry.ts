import type { AgentRole } from "./protocol.js";
import { StopSignal } from "./orchestrator.js";

/**
 * withRetry — retry em falhas transitórias de rede/gateway (E4 — Fase 2).
 *
 * - Retenta apenas erros classificados como transitórios (isTransientError).
 * - Nunca retenta StopSignal (abort).
 * - Backoff exponencial + jitter, configurável por env.
 * - signal.aborted durante o backoff lança StopSignal imediatamente.
 */

const RETRY_MAX = Number(process.env.PI_RETRY_MAX) || 3;
const RETRY_BASE_MS = Number(process.env.PI_RETRY_BASE_MS) || 1000;
const RETRY_BACKOFF_FACTOR = Number(process.env.PI_RETRY_BACKOFF_FACTOR) || 2;
const MAX_DELAY_MS = 30_000;

export interface RetryOptions {
  /** Papel do agente (usado no callback onRetry e no evento). */
  role: AgentRole;
  /** Máximo de tentativas (default: PI_RETRY_MAX ou 3). */
  maxAttempts?: number;
  /** Delay base em ms (default: PI_RETRY_BASE_MS ou 1000). */
  baseMs?: number;
  /** Fator de backoff exponencial (default: PI_RETRY_BACKOFF_FACTOR ou 2). */
  factor?: number;
  /** Callback chamado a cada retry (antes do sleep de backoff). */
  onRetry?: (info: { role: AgentRole; attempt: number; maxAttempts: number; delayMs: number; reason: string }) => void;
  /** Sinal de abort — desliga o retry e lança StopSignal. */
  signal?: AbortSignal;
}

/**
 * Classifica um erro como transitório (rede/gateway) com base na mensagem.
 * Na dúvida (padrão não reconhecido), NÃO classifica como transitório — fail fast.
 */
export function isTransientError(err: unknown): boolean {
  if (err instanceof StopSignal) return false;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // Padrões de rede
  if (msg.includes("econnrefused")) return true;
  if (msg.includes("etimedout")) return true;
  if (msg.includes("enotfound")) return true;
  if (msg.includes("network")) return true;
  if (msg.includes("fetch failed")) return true;
  // HTTP 5xx
  if (/5\d{2}/.test(msg)) return true;
  return false;
}

function computeDelay(attempt: number, baseMs: number, factor: number): number {
  const exponential = baseMs * Math.pow(factor, attempt - 1);
  const jitter = Math.random() * 1000;
  return Math.min(exponential + jitter, MAX_DELAY_MS);
}

/**
 * Executa `fn` com retry em falhas transitórias.
 *
 * Comportamento:
 * - Se `fn()` resolve → retorna o valor.
 * - Se `fn()` rejeita com erro transitório → backoff e retry (até maxAttempts).
 * - Se `fn()` rejeita com erro NÃO transitório → re-lança imediatamente.
 * - Se `signal.aborted` → lança StopSignal (antes de tentar ou durante o backoff).
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? RETRY_MAX;
  const baseMs = opts.baseMs ?? RETRY_BASE_MS;
  const factor = opts.factor ?? RETRY_BACKOFF_FACTOR;
  const { signal, role, onRetry } = opts;

  if (signal?.aborted) throw new StopSignal();

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new StopSignal();

    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      if (!isTransientError(err)) throw err;

      if (attempt < maxAttempts && !signal?.aborted) {
        const delayMs = computeDelay(attempt, baseMs, factor);
        onRetry?.({
          role,
          attempt,
          maxAttempts,
          delayMs,
          reason: err instanceof Error ? err.message : String(err),
        });

        // Espera com abort detection — captura o reject do onAbort
        // para evitar unhandled rejection em ambiente de teste com fake timers
        await new Promise<void>((resolve, reject) => {
          if (signal?.aborted) {
            reject(new StopSignal());
            return;
          }
          let settled = false;
          const timer = setTimeout(() => { settled = true; resolve(); }, delayMs);
          const onAbort = () => {
            if (settled) return;
            clearTimeout(timer);
            reject(new StopSignal());
          };
          signal?.addEventListener("abort", onAbort, { once: true });
          if (signal?.aborted && !settled) {
            clearTimeout(timer);
            reject(new StopSignal());
          }
        });
      }
    }
  }

  throw lastError;
}
