/**
 * Cálculo de custo em memória a partir do pricing do llmgateway (E10 — Fase 3).
 *
 * O SDK reporta tokens (input/output) via `getSessionStats()`, mas o custo sai
 * 0 quando o `models.json` não tem `cost`. Este helper substitui o cálculo:
 * multiplica os tokens pelo preço em $/milhão de tokens.
 */

export function calculateCostFromPricing(
  tokens: { input: number; output: number },
  pricing: { prompt: number; completion: number },
): number {
  const inputCost = (tokens.input / 1_000_000) * pricing.prompt;
  const outputCost = (tokens.output / 1_000_000) * pricing.completion;
  return inputCost + outputCost;
}
