import { z } from "zod";

/**
 * Protocolo de comunicação entre o Engine (sidecar Node) e o cliente (Rust bridge / UI).
 *
 * - Comandos (UI -> Engine): uma linha JSON no stdin do processo engine.
 * - Eventos (Engine -> UI): uma linha JSON por evento no stdout do processo engine.
 *
 * O schema com Zod garante que comandos inválidos sejam rejeitados antes de
 * afetar o orquestrador (defense-in-depth no transporte, não no parsing de LLM).
 */

/**
 * Modelos por papel de agente (override opcional vindo da UI — ModelSettingsModal).
 * Chaves ausentes caem no default do engine (PI_DEFAULT_MODEL / PI_CRISIS_MODEL).
 */
export const AgentModelsSchema = z.object({
  planejador: z.string().optional(),
  leitor: z.string().optional(),
  techlead: z.string().optional(),
  coder: z.string().optional(),
  testador: z.string().optional(),
  qa: z.string().optional(),
  crise: z.string().optional(),
});
export type AgentModels = z.infer<typeof AgentModelsSchema>;

/** Nível de thinking por papel (override opcional vindo da UI — E10). */
export const AgentThinkingSchema = z.object({
  planejador: z.string().optional(),
  leitor: z.string().optional(),
  techlead: z.string().optional(),
  coder: z.string().optional(),
  testador: z.string().optional(),
  qa: z.string().optional(),
  crise: z.string().optional(),
});
export type AgentThinking = z.infer<typeof AgentThinkingSchema>;

export const EngineCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), projectDir: z.string().min(1), models: AgentModelsSchema.optional(), thinking: AgentThinkingSchema.optional() }),
  z.object({ type: z.literal("plan"), projectDir: z.string().min(1), prompt: z.string().min(1), models: AgentModelsSchema.optional(), thinking: AgentThinkingSchema.optional() }),
  z.object({ type: z.literal("graph"), projectDir: z.string().min(1) }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("resume") }),
  z.object({ type: z.literal("inject"), text: z.string().min(1) }),
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("crisis-accept") }),
  z.object({ type: z.literal("crisis-revert") }),
  z.object({ type: z.literal("models-list") }),
  z.object({ type: z.literal("models-register"), modelId: z.string().min(1), name: z.string().min(1), pricing: z.object({ prompt: z.number(), completion: z.number() }).nullable() }),
  z.object({ type: z.literal("ping") }),
]);

export type EngineCommand = z.infer<typeof EngineCommandSchema>;

export type EngineStatus =
  | "idle"
  | "starting"
  | "running"
  | "waiting"
  | "done"
  | "error"
  | "stopping";

export type AgentRole =
  | "planejador" // gera o PLAN.md a partir do escopo
  | "leitor" // próxima fase do PLAN.md (structured output / fallback)
  | "techlead" // gera TODO_BATCH.md
  | "coder" // executa o lote
  | "testador" // verifica a fase (testes ou entregáveis) e escreve test-result.json
  | "qa" // julgamento TDD (structured output)
  | "crise"; // modelo sênior no protocolo de crise

export type EngineEvent =
  | { type: "ready"; version: string; mock: boolean; projectDir: string | null }
  | { type: "status"; status: EngineStatus; detail?: string; stage?: "reading-plan" | "techlead" | "coder" | "testador" | "qa" | "crisis" | "commit" | "graph" | "plan" }
  | { type: "log"; level: "info" | "warn" | "error" | "debug"; message: string }
  | { type: "phase"; fase: string | null; total: number; done: number; pct: number }
  | { type: "phase-start"; fase: string }
  | { type: "plan-done"; projectDir: string }
  | { type: "graph-start"; projectDir: string }
  | { type: "graph-ready"; projectDir: string; reportPath?: string }
  | { type: "graph-error"; message: string }
  | { type: "agent-start"; role: AgentRole; attempt?: number; maxAttempts?: number; model?: string; fallback?: boolean }
  | { type: "token"; role: AgentRole; delta: string }
  | { type: "thinking"; role: AgentRole; delta: string }
  | { type: "agent-message"; role: AgentRole; kind: "text" | "thinking"; text: string }
  | { type: "tool-call"; role: AgentRole; tool: string; args: string }
  | { type: "tool-result"; role: AgentRole; tool: string; ok: boolean; summary: string }
  | {
      type: "agent-end";
      role: AgentRole;
      stats?: {
        tokens: { input: number; output: number; total: number };
        cost: number;
      };
      /** Wall clock da sessão do agente, em milissegundos (telemetria E4). */
      durationMs?: number;
      /** E10 — motivo do custo (feedback visual quando não há pricing). */
      costReason?: "pricing" | "sdk" | "no-pricing" | "not-found" | "not-loaded";
    }
  | { type: "test"; state: "start" | "ok" | "fail" | "output"; output?: string }
  | { type: "qa-verdict"; veredito: "ESPERADO" | "INESPERADO"; justificativa?: string }
  | { type: "phase-done"; fase: string }
  | { type: "commit"; ok: boolean; message?: string }
  | { type: "crisis"; message: string; diff?: string }
  | { type: "retry"; role: AgentRole; attempt: number; maxAttempts: number; delayMs: number; reason: string }
  | { type: "paused" }
  | { type: "resumed" }
  | { type: "injected"; text: string }
  | { type: "done"; message: string }
  | { type: "error"; message: string; fase?: string; role?: AgentRole }
  | { type: "models-list-result"; models: { id: string; name: string; provider: string; pricing: { prompt: number; completion: number } | null; reasoningEfforts?: string[] }[]; ok: boolean; reason?: string }
  | { type: "exit"; code: number | null; reason?: string };

/** Escreve um evento como linha JSON no stdout (canal usado pela UI via Rust bridge). */
export function emit(event: EngineEvent): void {
  process.stdout.write(JSON.stringify(event) + "\n");
}
