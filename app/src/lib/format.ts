/** Formatação compacta de métricas do loop (tokens/custo). */

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatCost(n: number): string {
  return `US$ ${n.toFixed(4)}`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Formata diferença entre agora e um timestamp (ms) em texto relativo legível. */
export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  const diffMs = nowMs - timestampMs;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1h atrás" : `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1d atrás" : `${days}d atrás`;
}
