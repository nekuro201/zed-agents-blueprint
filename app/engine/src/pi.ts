import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { ZodType } from "zod";
import type { AgentRole, EngineEvent } from "./protocol.js";

/**
 * Wrapper fino sobre o SDK real do pi coding agent (@earendil-works/pi-coding-agent).
 *
 * Design de protótipo:
 * - `agentRun`  -> sessão com ferramentas (techlead/coder/crise) que edita arquivos de verdade.
 * - `structured`-> sessão SEM ferramentas que responde JSON estrito validado por Zod
 *                  (substitui o "regex sobre texto de LLM" do automacao.js original).
 *
 * Toda chamada ao SDK é defensiva: erros são capturados e transformados em
 * eventos `log`/`error`, nunca derrubam o processo. O modelo pode ser trocado
 * por nome ("provider/modelId") via ModelRegistry — se a resolução falhar,
 * usamos o modelo padrão configurado no `~/.pi/agent` do usuário.
 */

export interface AgentRunOptions {
  role: AgentRole;
  projectDir: string;
  prompt: string;
  /** Referência "provider/modelId", ex.: "llmgateway/deepseek-v4-flash". Best-effort. */
  model?: string;
  thinkingLevel?: ThinkingLevel;
  onEvent?: (e: EngineEvent) => void;
  /** Sinais de abort (Stop) — dispara `session.abort()` na sessão atual. */
  signal?: AbortSignal;
}

export interface AgentRunResult {
  text: string;
  thinking: string;
  stats?: { tokens: { input: number; output: number; total: number }; cost: number };
}

export interface StructuredOptions<T> {
  role: AgentRole;
  projectDir: string;
  prompt: string;
  schema: ZodType<T>;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  onEvent?: (e: EngineEvent) => void;
  signal?: AbortSignal;
}

const MAX_PARSE_ATTEMPTS = 3;
const DEFAULT_THINKING: ThinkingLevel = "low";

let sdk: typeof import("@earendil-works/pi-coding-agent") | null = null;

async function importSdk() {
  if (!sdk) {
    sdk = await import("@earendil-works/pi-coding-agent");
  }
  return sdk;
}

function truncate(s: string, n = 400): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function safeJson(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v, null, 0) ?? "";
  } catch {
    return String(v);
  }
}

/** Liga o abort da sessão a um AbortSignal. */
function wireAbort(session: AgentSession, signal?: AbortSignal): () => void {
  if (!signal) return () => undefined;
  const onAbort = () => {
    session.abort().catch(() => undefined);
  };
  if (signal.aborted) {
    onAbort();
    return () => undefined;
  }
  signal.addEventListener("abort", onAbort, { once: true });
  return () => signal.removeEventListener("abort", onAbort);
}

/** Resolve o modelo por nome e aplica na sessão. Nunca lança. */
async function applyModelBestEffort(
  session: AgentSession,
  modelRef?: string,
  onEvent?: (e: EngineEvent) => void,
): Promise<void> {
  if (!modelRef) return;
  const slash = modelRef.indexOf("/");
  const provider = slash >= 0 ? modelRef.slice(0, slash) : modelRef;
  const id = slash >= 0 ? modelRef.slice(slash + 1) : modelRef;
  try {
    const { ModelRegistry } = await importSdk();
    const registry = new ModelRegistry(session.modelRuntime);
    await registry.refresh();
    const model = registry.find(provider, id);
    if (model) {
      await session.setModel(model);
    } else {
      onEvent?.({ type: "log", level: "warn", message: `Modelo "${modelRef}" não encontrado no registry; usando o padrão configurado.` });
    }
  } catch (err) {
    onEvent?.({ type: "log", level: "warn", message: `Falha ao resolver modelo "${modelRef}": ${(err as Error).message}` });
  }
}

/** Extrai texto e thinking da última mensagem do assistente. */
function extractLastAssistant(session: AgentSession): { text: string; thinking: string } {
  let text = "";
  let thinking = "";
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];
    if (!msg || msg.role !== "assistant") continue;
    for (const part of msg.content) {
      if (part.type === "text") text += part.text;
      else if (part.type === "thinking") thinking += part.thinking;
    }
    break; // apenas a última mensagem de assistente
  }
  return { text: text.trim(), thinking: thinking.trim() };
}

function safeStats(session: AgentSession): AgentRunResult["stats"] {
  try {
    const stats = session.getSessionStats();
    return {
      tokens: { input: stats.tokens.input, output: stats.tokens.output, total: stats.tokens.total },
      cost: stats.cost,
    };
  } catch {
    return undefined;
  }
}

/** Mapeia eventos do AgentSession para o protocolo da UI, de forma tolerante. */
function mapAgentEvent(
  event: AgentSessionEvent,
  role: AgentRole,
  onEvent?: (e: EngineEvent) => void,
): void {
  switch (event.type) {
    case "message_update": {
      const ev = event.assistantMessageEvent;
      if (!ev) break;
      if (ev.type === "text_delta") {
        onEvent?.({ type: "token", role, delta: ev.delta });
      } else if (ev.type === "thinking_delta") {
        onEvent?.({ type: "thinking", role, delta: ev.delta });
      }
      break;
    }
    case "tool_execution_start":
      onEvent?.({ type: "tool-call", role, tool: event.toolName, args: truncate(safeJson(event.args), 300) });
      break;
    case "tool_execution_end":
      onEvent?.({ type: "tool-result", role, tool: event.toolName, ok: !event.isError, summary: truncate(safeJson(event.result), 300) });
      break;
    case "bash_execution_update":
      onEvent?.({ type: "log", level: "debug", message: `[bash] ${event.delta}` });
      break;
    default:
      break;
  }
}

/**
 * Executa um agente com ferramentas (techlead/coder/sênior).
 * Retorna texto final + thinking + stats. Lança erro em falha/env/abort.
 */
export async function agentRun(opts: AgentRunOptions): Promise<AgentRunResult> {
  const { createAgentSession } = await importSdk();
  const { session } = await createAgentSession({
    cwd: opts.projectDir,
    thinkingLevel: opts.thinkingLevel ?? DEFAULT_THINKING,
  });

  emit(opts, { type: "agent-start", role: opts.role, model: opts.model });
  const unsub = session.subscribe((ev) => mapAgentEvent(ev, opts.role, opts.onEvent));
  const detachAbort = wireAbort(session, opts.signal);

  try {
    await applyModelBestEffort(session, opts.model, opts.onEvent);
    await session.prompt(opts.prompt, { expandPromptTemplates: true });
    await session.waitForIdle();

    const result = extractLastAssistant(session);
    const stats = safeStats(session);
    emit(opts, { type: "agent-end", role: opts.role, stats });
    return { text: result.text, thinking: result.thinking, stats };
  } finally {
    detachAbort();
    unsub();
    session.dispose();
  }
}

const FENCE = /```(?:json)?\s*([\s\S]*?)\s*```/g;

/** Remove blocos de código/markdown e espaços ao redor do JSON. */
function extractJsonBlock(raw: string): string {
  FENCE.lastIndex = 0;
  const m = FENCE.exec(raw);
  if (m) return m[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }
  return raw.trim();
}

/**
 * Saída estruturada: sessão sem ferramentas, modelo responde JSON, validamos com
 * Zod e pedimos correção em caso de falha de parse (até MAX_PARSE_ATTEMPTS).
 * Este é o substituto definitivo do regex sobre stdout do script original.
 */
export async function structured<T>(opts: StructuredOptions<T>): Promise<T> {
  const { createAgentSession } = await importSdk();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt++) {
    const { session } = await createAgentSession({
      cwd: opts.projectDir,
      tools: [],
      thinkingLevel: opts.thinkingLevel ?? "off",
    });
    emit(opts, { type: "agent-start", role: opts.role, model: opts.model, attempt, maxAttempts: MAX_PARSE_ATTEMPTS });

    const unsub = session.subscribe((ev) => mapAgentEvent(ev, opts.role, opts.onEvent));
    const detachAbort = wireAbort(session, opts.signal);

    try {
      await applyModelBestEffort(session, opts.model, opts.onEvent);

      const fix = lastError
        ? `\n\nATENÇÃO: a resposta anterior não foi um JSON válido. Erro: ${(lastError as Error).message}\nResponda NOVAMENTE, apenas com JSON envolto em um único bloco \`\`\`json.\``
        : "";
      await session.prompt(
        `${opts.prompt}${fix}\n\nResponda exclusivamente com um único bloco JSON (\`\`\`json ... \`\`\`). Nada além do JSON.`,
        { expandPromptTemplates: false },
      );
      await session.waitForIdle();

      const assistant = extractLastAssistant(session);
      const raw = assistant.text || assistant.thinking;

      try {
        const parsed = opts.schema.parse(JSON.parse(extractJsonBlock(raw)));
        emit(opts, { type: "agent-end", role: opts.role, stats: safeStats(session) });
        return parsed;
      } catch (err) {
        lastError = err;
        onEventLog(opts, `Parse estruturado falhou (tentativa ${attempt}/${MAX_PARSE_ATTEMPTS}): ${(err as Error).message}`);
      }
    } finally {
      detachAbort();
      unsub();
      session.dispose();
    }
  }

  throw new Error(
    `Não foi possível obter resposta estruturada após ${MAX_PARSE_ATTEMPTS} tentativas: ${(lastError as Error)?.message ?? "erro desconhecido"}`,
  );
}

function emit(opts: { onEvent?: (e: EngineEvent) => void }, e: EngineEvent): void {
  opts.onEvent?.(e);
}

function onEventLog(opts: { onEvent?: (e: EngineEvent) => void }, message: string): void {
  opts.onEvent?.({ type: "log", level: "warn", message });
}
