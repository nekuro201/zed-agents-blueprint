import type { ProcessMemory } from "./engine";
import { formatBytes } from "./format";

/**
 * Indicador de memória do rodapé (2.2.5).
 *
 * O Rust mede o RSS dos processos (app/webview/engine) e a UI só decide como
 * exibir: total para o chip, nível para a cor e detalhamento para o tooltip.
 * Lógica pura (sem React) para ser testável — o componente é só apresentação.
 */

export type MemoryLevel = "ok" | "warn" | "alert";

/** Limiares do indicador sobre o total dos RSS medidos. */
export const MEMORY_WARN_BYTES = 2 * 1024 ** 3;
export const MEMORY_ALERT_BYTES = 4 * 1024 ** 3;

/** Soma dos RSS disponíveis (o que pressiona o sistema). Null se nada foi medido. */
export function memoryTotal(mem: ProcessMemory | null): number | null {
  if (!mem) return null;
  const parts = [mem.app, mem.webview, mem.engine].filter((v): v is number => typeof v === "number");
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0);
}

/** Faixa de alerta do total (verde-ish abaixo de 2GB, âmbar ≥2GB, vermelho ≥4GB). */
export function memoryLevel(total: number | null): MemoryLevel {
  if (total === null) return "ok";
  if (total >= MEMORY_ALERT_BYTES) return "alert";
  if (total >= MEMORY_WARN_BYTES) return "warn";
  return "ok";
}

/** Detalhamento por processo (tooltip do chip). */
export function memoryBreakdown(mem: ProcessMemory): string {
  const fmt = (bytes: number | null): string => (bytes === null ? "—" : formatBytes(bytes));
  return `Memória (RSS) — UI: ${fmt(mem.webview)} · Motor: ${fmt(mem.engine)} · App: ${fmt(mem.app)}`;
}
