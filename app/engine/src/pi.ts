import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { ZodType } from "zod";
import type { AgentRole, EngineEvent } from "./protocol.js";
import { withRetry } from "./retry.js";
import { getModelPricing, getModelPricingStatus, type PricingStatus } from "./models.js";
import { calculateCostFromPricing } from "./cost.js";

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

const THINKING_LEVELS: ReadonlySet<string> = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

/** Converte um nível de thinking vindo da UI para um `ThinkingLevel` válido do SDK. */
export function toThinkingLevel(v: string | undefined): ThinkingLevel | undefined {
  if (!v) return undefined;
  return THINKING_LEVELS.has(v) ? (v as ThinkingLevel) : undefined;
}

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
    const t = stats?.tokens;
    return {
      tokens: {
        input: typeof t?.input === "number" ? t.input : 0,
        output: typeof t?.output === "number" ? t.output : 0,
        total: typeof t?.total === "number" ? t.total : 0,
      },
      cost: typeof stats?.cost === "number" ? stats.cost : 0,
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
  const startedAt = Date.now();
  let resolvedModel: string | undefined;

  return withRetry(
    async () => {
      const { createAgentSession } = await importSdk();
      const { session } = await createAgentSession({
        cwd: opts.projectDir,
        thinkingLevel: opts.thinkingLevel ?? DEFAULT_THINKING,
      });
      const unsub = session.subscribe((ev) => mapAgentEvent(ev, opts.role, opts.onEvent));
      const detachAbort = wireAbort(session, opts.signal);

      try {
        await applyModelBestEffort(session, opts.model, opts.onEvent);

        // E10 — emite o agent-start com o modelo REAL que foi usado na sessão
        // (pode ser diferente do configurado se caiu no fallback do ModelRegistry).
        const active = session.model;
        if (!active) {
          // 0 tokens é o sintoma clássico de sessão sem modelo: sem este check,
          // `session.prompt` rodaria em vazio e devolveria texto vazio + custo 0,
          // parecendo que o agente "rodou". Falhamos alto e visível.
          throw new Error(
            `Nenhum modelo foi resolvido para o agente "${opts.role}". Verifique o seletor de modelos (config) e o ~/.pi/agent/models.json + auth.json do pi.`,
          );
        }
        resolvedModel = `${active.provider}/${active.id}`;
        const fallback = resolvedModel !== opts.model;
        emit(opts, { type: "agent-start", role: opts.role, model: resolvedModel, fallback });

        if (fallback) {
          emit(opts, { type: "log", level: "warn", message: `Modelo configurado "${opts.model}" não encontrado; usando fallback "${resolvedModel}".` });
        }

        // expandPromptTemplates: false — nossos prompts são texto plano (skill + AGENTS.md +
        // instrução). O SDK vê comandos /skill ou templates {{ }} fora de bloco de código e
        // tenta expandi-los, podendo corromper o prompt.
        // O comportamento igual ao structured() (que também usa false) é seguro.

        // Diagnóstico: prompt vazio gera 0 tokens silencioso (o LLM nunca roda).
        if (!opts.prompt || opts.prompt.trim().length === 0) {
          throw new Error(
            `Prompt vazio para o agente "${opts.role}". Possível causa: skill não resolvida, AGENTS.md ou SKILL.md não encontrados no projectDir/skills.`,
          );
        }
        emit(opts, { type: "log", level: "debug", message: `[${opts.role}] Prompt enviado (${opts.prompt.length} chars, ~${Math.ceil(opts.prompt.length / 4)} tokens).` });

        await session.prompt(opts.prompt, { expandPromptTemplates: false });
        await session.waitForIdle();

        const result = extractLastAssistant(session);
        return { text: result.text, thinking: result.thinking, stats: safeStats(session) };
      } finally {
        // Sempre fecha o card e contabiliza os tokens, mesmo se a sessão for
        // abortada ou lançar erro — senão o consumo desses agentes some do total.
        const rawStats = safeStats(session);
        const resolvedRef = resolvedModel ?? opts.model ?? "";
        const pricing = getModelPricing(resolvedRef);
        // Se o SDK retornou cost=0 (models.json sem preço), mas nós temos
        // pricing do llmgateway cacheado localmente, usamos o nosso cálculo.
        // Só marcamos "sdk" quando o SDK retornou cost>0 e NÃO temos pricing.
        const sdkCost = rawStats?.cost ?? 0;
        const lllmCost = pricing
          ? calculateCostFromPricing(rawStats?.tokens ?? { input: 0, output: 0 }, pricing)
          : 0;
        const cost = pricing ? lllmCost : sdkCost;
        const costReason = pricing
          ? "pricing"
          : sdkCost > 0
            ? "sdk"
            : getModelPricingStatus(resolvedRef);
        const stats = rawStats
          ? { ...rawStats, cost }
          : undefined;
        if (costReason !== "pricing" && costReason !== "sdk") {
          emit(opts, { type: "log", level: "warn", message: costReasonMessage(costReason, resolvedRef) });
        } else if (costReason === "pricing" && sdkCost === 0) {
          emit(opts, { type: "log", level: "debug", message: `Custo calculado localmente para "${resolvedRef}" (${rawStats?.tokens?.input ?? 0} in + ${rawStats?.tokens?.output ?? 0} out → $${cost.toFixed(6)}).` });
        }
        emit(opts, { type: "agent-end", role: opts.role, stats, durationMs: Date.now() - startedAt, costReason });
        detachAbort();
        unsub();
        session.dispose();
      }
    },
    {
      role: opts.role,
      signal: opts.signal,
      onRetry: (info) => emit(opts, { type: "retry", ...info }),
    },
  );
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
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    let stats: AgentRunResult["stats"];
    let resolvedModel: string | undefined;

    try {
      const result = await withRetry(
        async () => {
          const { createAgentSession: create } = await importSdk();
          const { session } = await create({
            cwd: opts.projectDir,
            tools: [],
            thinkingLevel: opts.thinkingLevel ?? "off",
          });
          const unsub = session.subscribe((ev) => mapAgentEvent(ev, opts.role, opts.onEvent));
          const detachAbort = wireAbort(session, opts.signal);

          try {
            await applyModelBestEffort(session, opts.model, opts.onEvent);

            // E10 — resolve o modelo real (fallback se não configurado)
            const active = session.model;
            if (!active) {
              throw new Error(
                `Nenhum modelo foi resolvido para o agente "${opts.role}". Verifique o seletor de modelos (config) e o ~/.pi/agent/models.json + auth.json do pi.`,
              );
            }
            resolvedModel = `${active.provider}/${active.id}`;

            const fix = lastError
              ? `\n\nATENÇÃO: a resposta anterior não obedeceu ao formato JSON exigido. Erro: ${(lastError as Error).message}\nResponda NOVAMENTE com o JSON EXATO no formato pedido acima — apenas o JSON, sem texto, sem markdown, sem campos extras.`
              : "";
            await session.prompt(
              `${opts.prompt}${fix}\n\nResponda exclusivamente com um único bloco JSON (\`\`\`json ... \`\`\`). Nada além do JSON.`,
              { expandPromptTemplates: false },
            );
            await session.waitForIdle();

            const assistant = extractLastAssistant(session);
            return { text: assistant.text || assistant.thinking, stats: safeStats(session) };
          } finally {
            // Coleta os stats ANTES do dispose (igual ao agentRun) para o
            // agent-end externo não precisar inventar zeros.
            detachAbort();
            unsub();
            session.dispose();
          }
        },
        {
          role: opts.role,
          signal: opts.signal,
          onRetry: (info) => emit(opts, { type: "retry", ...info }),
        },
      );

      stats = result.stats;
      // Emite o agent-start com o modelo real (pode ser diferente do configurado).
      const fallback = !!resolvedModel && resolvedModel !== opts.model;
      emit(opts, { type: "agent-start", role: opts.role, model: resolvedModel ?? opts.model, attempt, maxAttempts: MAX_PARSE_ATTEMPTS, fallback });
      if (fallback) {
        emit(opts, { type: "log", level: "warn", message: `Modelo configurado "${opts.model}" não encontrado; usando fallback "${resolvedModel}".` });
      }

      try {
        const parsed = opts.schema.parse(JSON.parse(extractJsonBlock(result.text)));
        return parsed;
      } catch (err) {
        lastError = err;
        onEventLog(opts, `Parse estruturado falhou (tentativa ${attempt}/${MAX_PARSE_ATTEMPTS}): ${(err as Error).message}`);
      }
    } finally {
      // E10 — sobrescreve o cost com o pricing do llmgateway (se disponível),
      // já que o SDK pode retornar 0 quando models.json não tem cost.
      const resolvedRef = resolvedModel ?? opts.model ?? "";
      const pricing = getModelPricing(resolvedRef);
      const sdkCost = stats?.cost ?? 0;
      const lllmCost = pricing && stats
        ? calculateCostFromPricing(stats.tokens, pricing)
        : 0;
      const cost = pricing ? lllmCost : sdkCost;
      const costReason = pricing
        ? "pricing"
        : sdkCost > 0
          ? "sdk"
          : getModelPricingStatus(resolvedRef);
      if (costReason !== "pricing" && costReason !== "sdk") {
        onEventLog(opts, costReasonMessage(costReason, resolvedRef));
      }
      emit(opts, {
        type: "agent-end",
        role: opts.role,
        stats: stats ? { ...stats, cost } : { tokens: { input: 0, output: 0, total: 0 }, cost },
        durationMs: Date.now() - startedAt,
        costReason,
      });
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

/** Mensagem humana para o motivo de custo indisponível (feedback visual E10). */
function costReasonMessage(reason: PricingStatus, modelRef: string): string {
  switch (reason) {
    case "no-pricing":
      return `Sem preço conhecido para "${modelRef}": o modelo não reporta pricing na API do llmgateway.`;
    case "not-found":
      return `Modelo "${modelRef}" não encontrado na lista do llmgateway — sem preço para calcular o custo.`;
    case "not-loaded":
      return `Lista de modelos/preços não carregada — custo indisponível para "${modelRef}".`;
    default:
      return `Custo indisponível para "${modelRef}".`;
  }
}
