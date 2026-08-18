/** Formatação compacta de métricas do loop (tokens/custo). */

export function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function formatCost(n: number): string {
  return `US$ ${n.toFixed(4)}`;
}
