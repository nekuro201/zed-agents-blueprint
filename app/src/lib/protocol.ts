import { z } from "zod";

/**
 * Esquemas de eventos do Engine (espelho do `engine/src/protocol.ts`).
 * A UI valida tudo que chega do sidecar com Zod — qualquer evento inesperado é
 * ignorado com segurança (defense-in-depth do transporte, mesmo conceito do engine).
 */

export const EngineStatusSchema = z.enum([
  "idle",
  "starting",
  "running",
  "waiting",
  "done",
  "error",
  "stopping",
]);
export type EngineStatus = z.infer<typeof EngineStatusSchema>;

export const AgentRoleSchema = z.enum(["planejador", "leitor", "techlead", "coder", "qa", "crise"]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

const statsSchema = z.object({
  tokens: z.object({ input: z.number(), output: z.number(), total: z.number() }),
  cost: z.number(),
});

export const EngineEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), version: z.string(), mock: z.boolean(), projectDir: z.string().nullable() }),
  z.object({ type: z.literal("status"), status: EngineStatusSchema, detail: z.string().optional() }),
  z.object({ type: z.literal("log"), level: z.enum(["info", "warn", "error", "debug"]), message: z.string() }),
  z.object({ type: z.literal("phase"), fase: z.string().nullable(), total: z.number(), done: z.number(), pct: z.number() }),
  z.object({ type: z.literal("phase-start"), fase: z.string() }),
  z.object({ type: z.literal("plan-done"), projectDir: z.string() }),
  z.object({ type: z.literal("agent-start"), role: AgentRoleSchema, attempt: z.number().optional(), maxAttempts: z.number().optional(), model: z.string().optional() }),
  z.object({ type: z.literal("token"), role: AgentRoleSchema, delta: z.string() }),
  z.object({ type: z.literal("thinking"), role: AgentRoleSchema, delta: z.string() }),
  z.object({ type: z.literal("agent-message"), role: AgentRoleSchema, kind: z.enum(["text", "thinking"]), text: z.string() }),
  z.object({ type: z.literal("tool-call"), role: AgentRoleSchema, tool: z.string(), args: z.string() }),
  z.object({ type: z.literal("tool-result"), role: AgentRoleSchema, tool: z.string(), ok: z.boolean(), summary: z.string() }),
  z.object({ type: z.literal("agent-end"), role: AgentRoleSchema, stats: statsSchema.optional() }),
  z.object({ type: z.literal("test"), state: z.enum(["start", "ok", "fail", "output"]), output: z.string().optional() }),
  z.object({ type: z.literal("qa-verdict"), veredito: z.enum(["ESPERADO", "INESPERADO"]), justificativa: z.string().optional() }),
  z.object({ type: z.literal("phase-done"), fase: z.string() }),
  z.object({ type: z.literal("commit"), ok: z.boolean(), message: z.string().optional() }),
  z.object({ type: z.literal("crisis"), message: z.string() }),
  z.object({ type: z.literal("paused") }),
  z.object({ type: z.literal("resumed") }),
  z.object({ type: z.literal("injected"), text: z.string() }),
  z.object({ type: z.literal("done"), message: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("exit"), code: z.number().nullable(), reason: z.string().optional() }),
]);

export type EngineEvent = z.infer<typeof EngineEventSchema>;

/** Comandos enviados da UI para o engine (mesmo formato do engine/src/protocol.ts). */
export type EngineCommand =
  | { type: "start"; projectDir: string }
  | { type: "plan"; projectDir: string; prompt: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "inject"; text: string }
  | { type: "stop" }
  | { type: "ping" };
