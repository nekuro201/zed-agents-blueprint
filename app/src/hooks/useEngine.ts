import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { engineSend, engineStart, engineStop, isTauri, onEngineEvent, onEngineExit, onEngineLog } from "../lib/engine";
import { EngineEventSchema, type AgentModels, type AgentThinking, type AgentRole, type EngineCommand, type EngineEvent, type EngineStatus, type PlanHistoryItem } from "../lib/protocol";

export type ToolEvent = { tool: string; args: string; ok?: boolean; summary?: string };

export type TimelineItem =
  | { id: number; kind: "phase"; fase: string; order: number }
  | {
      id: number;
      kind: "agent";
      role: AgentRole;
      model?: string;
      fallback?: boolean;
      costReason?: "pricing" | "sdk" | "no-pricing" | "not-found" | "not-loaded";
      attempt?: number;
      maxAttempts?: number;
      ended: boolean;
      thinking: string;
      text: string;
      /** 2.2.4 — true quando algum conteúdo do card (texto/thinking/tools) foi truncado por cap de memória. */
      capped?: boolean;
      stats?: { tokens: { input: number; output: number; total: number }; cost: number };
      durationMs?: number;
      tools: ToolEvent[];
    }
  | { id: number; kind: "test"; state: "start" | "ok" | "fail"; output: string }
  | { id: number; kind: "qa"; veredito: "ESPERADO" | "INESPERADO"; justificativa?: string }
  | { id: number; kind: "commit"; ok: boolean; message?: string }
  | { id: number; kind: "crisis"; message: string; diff?: string }
  | { id: number; kind: "retry"; role: AgentRole; attempt: number; maxAttempts: number; delayMs: number; reason: string }
  | { id: number; kind: "injected"; text: string }
  | { id: number; kind: "log"; level: "info" | "warn" | "error"; message: string }
  | { id: number; kind: "status"; message: string; sub?: string; stage?: string; status?: string };

export interface EngineUiState {
  tauri: boolean;
  connected: boolean;
  mock: boolean;
  version: string | null;
  status: EngineStatus | "idle" | "offline";
  detail?: string;
  /** E4 — etapa corrente do loop (derivado do stage no evento status). */
  stage?: "reading-plan" | "techlead" | "coder" | "testador" | "qa" | "crisis" | "commit" | "graph" | "plan";
  running: boolean;
  /** Verdadiero quando o loop terminou com TODAS as fases do PLAN.md concluídas. */
  completed: boolean;
  /** 2.2.3 — duração do loop e acumuladores reais de tokens/custo. */
  elapsed: number;
  tokens: { input: number; output: number; total: number };
  cost: number;
  /** Telemetria E4 — duração acumulada dos agentes (wall clock, ms). */
  durationMs: number;
  projectDir: string | null;
  phase: { fase: string | null; total: number; done: number; pct: number } | null;
  error: string | null;
  /** E4 — contexto do erro (fase/agente onde ocorreu). */
  errorFase?: string;
  errorRole?: AgentRole;
  /** E3 — estado do grafo de conhecimento (derivado dos eventos graph-*). */
  graphStatus: "empty" | "loading" | "ready";
  graphError: string | null;
  timeline: TimelineItem[];
  planning: boolean;
}

const initialState: EngineUiState = {
  tauri: false,
  connected: false,
  mock: false,
  version: null,
  status: "offline",
  running: false,
  completed: false,
  elapsed: 0,
  tokens: { input: 0, output: 0, total: 0 },
  cost: 0,
  durationMs: 0,
  projectDir: null,
  phase: null,
  error: null,
  graphStatus: "empty",
  graphError: null,
  timeline: [],
  planning: false,
};

export { initialState };

/** Persistência dos acumuladores de tokens/custo (separados por workspace). */
const USAGE_KEY = "pi-factory:usage-totals";

export interface UsageTotals {
  tokens: { input: number; output: number; total: number };
  cost: number;
}

function zero(): UsageTotals {
  return { tokens: { input: 0, output: 0, total: 0 }, cost: 0 };
}

type UsageMap = Record<string, UsageTotals>;

function loadUsageMap(): UsageMap {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as UsageMap) : {};
  } catch {
    return {};
  }
}

function saveUsageMap(map: UsageMap): void {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage indisponível/cheio — nunca quebra a app.
  }
}

export function loadUsageTotals(projectDir: string): UsageTotals {
  const t = loadUsageMap()[projectDir];
  if (!t || typeof t !== "object") return zero();
  return {
    tokens: {
      input: typeof t.tokens?.input === "number" ? t.tokens.input : 0,
      output: typeof t.tokens?.output === "number" ? t.tokens.output : 0,
      total: typeof t.tokens?.total === "number" ? t.tokens.total : 0,
    },
    cost: typeof t.cost === "number" ? t.cost : 0,
  };
}

export function saveUsageTotals(projectDir: string, totals: UsageTotals): void {
  const map = loadUsageMap();
  map[projectDir] = totals;
  saveUsageMap(map);
}

let nextId = 1;

/** Cap de conteúdo por card de agente (2.2.4) — o nº de itens já é capado;
 * o conteúdo de texto/thinking/tools de cada card NUNCA cresce sem teto. */
export const MAX_AGENT_TEXT = 100_000;
export const MAX_AGENT_TOOLS = 200;

/** Concatena com cap de tamanho, mantendo a CAUDA (conteúdo mais recente do
 * streaming — o que está visível no terminal). Retorna se o cap foi atingido. */
function appendCapped(current: string, delta: string, max: number): { value: string; capped: boolean } {
  if (!delta) return { value: current, capped: false };
  const next = current + delta;
  if (next.length <= max) return { value: next, capped: false };
  return { value: next.slice(-max), capped: true };
}

export type Action =
  | { type: "event"; ev: EngineEvent }
  | { type: "tick" }
  | { type: "boot"; tauri: boolean }
  | { type: "setUsage"; totals: UsageTotals }
  | { type: "reset" };

/** Índice (do fim) do último card de agente ainda aberto. */
function lastOpenAgent(tl: TimelineItem[]): number {
  for (let i = tl.length - 1; i >= 0; i--) {
    const it = tl[i];
    if (it && it.kind === "agent" && !it.ended) return i;
  }
  return -1;
}

function lastIndexWhere(tl: TimelineItem[], pred: (it: TimelineItem) => boolean): number {
  for (let i = tl.length - 1; i >= 0; i--) {
    if (pred(tl[i]!)) return i;
  }
  return -1;
}

function reduceUncapped(state: EngineUiState, action: Action): EngineUiState {
  // Tick do timer (2.2.3): acontece fora do fluxo de eventos — sem `ev`.
  if (action.type === "tick") {
    const ticking = state.status === "running" || state.status === "starting";
    return ticking ? { ...state, elapsed: state.elapsed + 1 } : state;
  }
  // Inicialização (bugfix): registra se estamos dentro do Tauri (habilita controles).
  if (action.type === "boot") {
    return { ...state, tauri: action.tauri };
  }
  // Troca de workspace: recarrega o uso (tokens/custo) daquele projeto.
  if (action.type === "setUsage") {
    return { ...state, tokens: action.totals.tokens, cost: action.totals.cost };
  }
  // Fechar workspace / voltar para Projetos: limpa o estado transitório do loop
  // (planning/running/timeline), preservando tokens/custo já acumulados.
  if (action.type === "reset") {
    return { ...initialState, tokens: state.tokens, cost: state.cost };
  }

  const { ev } = action;
  const tl = state.timeline;

  const setStatus = (status: EngineUiState["status"], detail?: string): EngineUiState => ({
    ...state,
    status,
    detail,
    running: status === "starting" || status === "running" || status === "waiting",
  });

  const withItem = (item: TimelineItem): EngineUiState => ({ ...state, timeline: [...tl, item] });

  /** Atualiza o card do agente aberto (ou retorna state sem mudança). */
  const patchAgent = (fn: (a: Extract<TimelineItem, { kind: "agent" }>) => Extract<TimelineItem, { kind: "agent" }>): EngineUiState => {
    const idx = lastOpenAgent(tl);
    if (idx < 0) return state;
    const copy = [...tl];
    const cur = copy[idx];
    if (!cur || cur.kind !== "agent") return state;
    copy[idx] = fn(cur);
    return { ...state, timeline: copy };
  };

  switch (ev.type) {
    case "ready":
      return { ...state, connected: true, mock: ev.mock, version: ev.version, projectDir: ev.projectDir, status: "idle", running: false };

    case "status": {
      const base = setStatus(ev.status, ev.detail);
      const stage = ev.stage ?? (ev.status === "idle" || ev.status === "done" ? undefined : state.stage);
      // `planning` é SÓ a geração do plano (composer). O "Lendo PLAN.md…" do início
      // do loop NÃO conta como planning — senão travava e bloqueava o reload dos docs.
      const planning = ev.status === "starting" && (ev.detail?.includes("gerando o PLAN.md") ?? false);
      if (ev.status === "starting") {
        // Novo loop ou nova geração: reseta timers do loop corrente,
        // mas MANTÉM tokens/cost acumulados da sessão inteira (E10).
        return { ...base, stage, elapsed: 0, durationMs: 0, completed: false, planning };
      }
      return { ...base, stage, planning: planning || (ev.status === "idle" ? false : state.planning) };
    }

    case "plan-done":
      return { ...state, planning: false, completed: false };

    case "graph-start":
      return { ...withItem({ id: nextId++, kind: "log", level: "info", message: `Grafo: gerando em ${ev.projectDir}…` }), graphStatus: "loading", graphError: null };

    case "graph-ready":
      return { ...withItem({ id: nextId++, kind: "log", level: "info", message: `Grafo: atualizado (report em ${ev.projectDir})` }), graphStatus: "ready", graphError: null };

    case "graph-error":
      return { ...withItem({ id: nextId++, kind: "log", level: "warn", message: `Grafo: ${ev.message}` }), graphStatus: "empty", graphError: ev.message };

    case "phase":
      return { ...state, phase: { fase: ev.fase, total: ev.total, done: ev.done, pct: ev.pct } };

    case "phase-start":
      return withItem({ id: nextId++, kind: "phase", fase: ev.fase, order: tl.length });

    case "agent-start": {
      const idx = lastOpenAgent(tl);
      if (idx >= 0) {
        // Fecha um agente que ficou aberto (segurança) antes de abrir o novo card.
        const copy = [...tl];
        const cur = copy[idx];
        if (cur && cur.kind === "agent") copy[idx] = { ...cur, ended: true };
        return {
          ...state,
          timeline: [
            ...copy,
            { id: nextId++, kind: "agent", role: ev.role, model: ev.model, fallback: ev.fallback, attempt: ev.attempt, maxAttempts: ev.maxAttempts, ended: false, thinking: "", text: "", tools: [] },
          ],
        };
      }
      return withItem({ id: nextId++, kind: "agent", role: ev.role, model: ev.model, fallback: ev.fallback, attempt: ev.attempt, maxAttempts: ev.maxAttempts, ended: false, thinking: "", text: "", tools: [] });
    }

    case "token":
      return patchAgent((a) => {
        const r = appendCapped(a.text, ev.delta, MAX_AGENT_TEXT);
        return { ...a, text: r.value, capped: a.capped || r.capped };
      });

    case "thinking":
      return patchAgent((a) => {
        const r = appendCapped(a.thinking, ev.delta, MAX_AGENT_TEXT);
        return { ...a, thinking: r.value, capped: a.capped || r.capped };
      });

    case "agent-message":
      if (ev.kind === "thinking") {
        return patchAgent((a) => {
          const r = appendCapped(a.thinking, ev.text, MAX_AGENT_TEXT);
          return { ...a, thinking: r.value, capped: a.capped || r.capped };
        });
      }
      return patchAgent((a) => {
        const r = appendCapped(a.text, ev.text, MAX_AGENT_TEXT);
        return { ...a, text: r.value, capped: a.capped || r.capped };
      });

    case "tool-call":
      return patchAgent((a) => {
        // Cap de tools por card: descarta a mais antiga ao estourar o teto.
        const tools =
          a.tools.length >= MAX_AGENT_TOOLS
            ? [...a.tools.slice(1), { tool: ev.tool, args: ev.args }]
            : [...a.tools, { tool: ev.tool, args: ev.args }];
        return { ...a, tools, capped: a.capped || a.tools.length >= MAX_AGENT_TOOLS };
      });

    case "tool-result":
      return patchAgent((a) => {
        const tools = [...a.tools];
        for (let i = tools.length - 1; i >= 0; i--) {
          if (tools[i] && tools[i].tool === ev.tool && tools[i].ok === undefined) {
            tools[i] = { ...tools[i], ok: ev.ok, summary: ev.summary };
            break;
          }
        }
        return { ...a, tools };
      });

    case "agent-end": {
      const base = patchAgent((a) => ({ ...a, ended: true, stats: ev.stats, durationMs: ev.durationMs, costReason: ev.costReason }));
      if (!ev.stats && ev.durationMs === undefined) return base;
      let next = base;
      if (ev.durationMs !== undefined) {
        next = { ...next, durationMs: next.durationMs + ev.durationMs };
      }
      if (ev.stats) {
        next = {
          ...next,
          tokens: {
            input: next.tokens.input + ev.stats.tokens.input,
            output: next.tokens.output + ev.stats.tokens.output,
            total: next.tokens.total + ev.stats.tokens.total,
          },
          cost: next.cost + ev.stats.cost,
        };
      }
      return next;
    }

    case "test": {
      const lastTestIdx = lastIndexWhere(tl, (it) => it.kind === "test" && it.state === "start");
      if (ev.state === "output") {
        if (lastTestIdx >= 0) {
          const copy = [...tl];
          const cur = copy[lastTestIdx];
          if (cur && cur.kind === "test") {
            copy[lastTestIdx] = { ...cur, output: cur.output + (ev.output ?? "") };
            return { ...state, timeline: copy };
          }
        }
        return withItem({ id: nextId++, kind: "test", state: "start", output: ev.output ?? "" });
      }
      // ok | fail — consolida no card em andamento (se houver).
      if (lastTestIdx >= 0) {
        const copy = [...tl];
        const cur = copy[lastTestIdx];
        if (cur && cur.kind === "test") {
          copy[lastTestIdx] = { ...cur, state: ev.state };
          return { ...state, timeline: copy };
        }
      }
      return withItem({ id: nextId++, kind: "test", state: ev.state, output: "" });
    }

    case "qa-verdict":
      return withItem({ id: nextId++, kind: "qa", veredito: ev.veredito, justificativa: ev.justificativa });

    case "phase-done":
      return withItem({ id: nextId++, kind: "status", message: `✅ ${ev.fase} concluída` });

    case "commit":
      return withItem({ id: nextId++, kind: "commit", ok: ev.ok, message: ev.message });

    case "crisis":
      return { ...withItem({ id: nextId++, kind: "crisis", message: ev.message, diff: ev.diff }), error: null };

    case "retry":
      return withItem({ id: nextId++, kind: "retry", role: ev.role, attempt: ev.attempt, maxAttempts: ev.maxAttempts, delayMs: ev.delayMs, reason: ev.reason });

    case "injected":
      return withItem({ id: nextId++, kind: "injected", text: ev.text });

    case "paused":
      return { ...setStatus("waiting", "Pausado pelo usuário"), timeline: [...tl, { id: nextId++, kind: "status", message: "⏸ Pausado — aguardando retomada", status: "waiting" }] };

    case "resumed":
      return { ...setStatus("running"), timeline: [...tl, { id: nextId++, kind: "status", message: "▶ Retomado", sub: "Fluxo continuando…", status: "running" }] };

    case "log":
      if (ev.level === "debug") return state;
      return withItem({ id: nextId++, kind: "log", level: ev.level, message: ev.message });

    case "error":
      return { ...setStatus("error"), error: ev.message, errorFase: ev.fase, errorRole: ev.role, planning: false, timeline: [...tl, { id: nextId++, kind: "status", message: `❌ ${ev.message}`, status: "error" }] };

    case "done":
      return { ...setStatus("done"), completed: true, timeline: [...tl, { id: nextId++, kind: "status", message: ev.message }] };

    case "exit":
      return { ...state, connected: false, running: false };

    default:
      return state;
  }
}

/** Cap de estado (2.2.4): timeline fica limitada em memória — nunca cresce sem teto. */
const MAX_TIMELINE_ITEMS = 500;

/** Intervalo de flush do buffer de streaming (2.2.4): agrupa deltas de
 * token/thinking para a UI não re-renderizar a cada token do SDK. */
const STREAM_FLUSH_MS = 200;

export function reducer(state: EngineUiState, action: Action): EngineUiState {
  const next = reduceUncapped(state, action);
  if (next.timeline.length > MAX_TIMELINE_ITEMS) {
    return { ...next, timeline: next.timeline.slice(-MAX_TIMELINE_ITEMS) };
  }
  return next;
}

/** Card do Planejador (derivado da timeline) — streaming ou já concluído. */
export interface PlannerCard {
  thinking: string;
  text: string;
  model?: string;
  fallback?: boolean;
  costReason?: string;
  ended: boolean;
  stats?: { tokens: { total: number }; cost: number };
}

// ── Store externo (2.2.4 — isolamento de streaming) ───────────────────────
// O estado do engine vive fora do ciclo de vida do React (singleton do app).
// Com `useSyncExternalStore`, cada consumidor assina apenas o pedaço que usa:
// o App e as views inativas NÃO re-renderizam a cada flush de streaming — só
// quem consome o campo que mudou (ex.: o EnginePanel assina o estado inteiro,
// pois mostra o terminal em tempo real).

let storeState: EngineUiState = initialState;
const storeListeners = new Set<() => void>();

/** Card do Planejador derivado da timeline, cacheado por referência do card de
 * agente: fica estável enquanto o card não muda, então views que só mostram o
 * Planejador (Chat da Thread) não re-renderizam durante um loop — apenas
 * durante o streaming do próprio Planejador. */
let plannerSource: Extract<TimelineItem, { kind: "agent" }> | null = null;
let plannerCardRef: PlannerCard | null = null;

function recomputePlannerCard(): void {
  const tl = storeState.timeline;
  for (let i = tl.length - 1; i >= 0; i--) {
    const it = tl[i];
    if (it && it.kind === "agent" && it.role === "planejador") {
      if (it !== plannerSource) {
        plannerSource = it;
        plannerCardRef = {
          thinking: it.thinking,
          text: it.text,
          model: it.model,
          fallback: it.fallback,
          costReason: it.costReason,
          ended: it.ended,
          stats: it.stats,
        };
      }
      return;
    }
  }
  if (plannerSource !== null) {
    plannerSource = null;
    plannerCardRef = null;
  }
}

function dispatch(action: Action): void {
  const next = reducer(storeState, action);
  if (next === storeState) return; // nada mudou (ex.: debug log) — não notifica
  storeState = next;
  recomputePlannerCard();
  storeListeners.forEach((l) => l());
}

/** Reseta o store para o estado inicial (isolamento entre testes/sessões). */
export function resetEngineStore(): void {
  storeState = initialState;
  plannerSource = null;
  plannerCardRef = null;
  storeListeners.forEach((l) => l());
}

export { dispatch };

/**
 * Despacha um evento do protocolo direto no store (sem o buffer de streaming).
 * Usado por testes e por ferramentas externas; o fluxo normal passa pela
 * `useEngine` (listeners do Tauri + buffer).
 */
export function dispatchEngineEvent(ev: EngineEvent): void {
  dispatch({ type: "event", ev });
}

function subscribe(listener: () => void): () => void {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

function getState(): EngineUiState {
  return storeState;
}

/** Assina o estado inteiro — re-renderiza a cada mudança (usado pelo painel do
 * loop, que exibe o terminal em tempo real). */
export function useEngineState(): EngineUiState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** Assina um pedaço do estado — re-renderiza só quando o valor selecionado
 * muda. O seletor deve retornar um primitivo ou uma referência estável (os
 * campos do estado mantêm a referência quando não mudam). */
export function useEngineSelector<T>(selector: (s: EngineUiState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getState()), () => selector(getState()));
}

/** Card do Planejador (derivado da timeline, cacheado) — referência estável
 * enquanto o card não muda. */
export function usePlannerCard(): PlannerCard | null {
  return useSyncExternalStore(subscribe, () => plannerCardRef, () => plannerCardRef);
}

import { handleModelsListResult } from "./useModelList";

/** Despacha eventos que não passam pelo reducer para seus respectivos handlers globais. */
export function handleEventDispatch(ev: EngineEvent): void {
  if (ev.type === "models-list-result") handleModelsListResult(ev);
}

export interface EngineActions {
  start: (projectDir: string, mock: boolean, models?: AgentModels, thinking?: AgentThinking) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  inject: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  /** E4 — aceita o TODO_BATCH.md reescrito pelo agente crise e retoma o loop. */
  crisisAccept: () => Promise<void>;
  /** E4 — restaura o snapshot do TODO_BATCH.md e encerra para auditoria humana. */
  crisisRevert: () => Promise<void>;
  /** Pede ao engine para gerar o PLAN.md a partir do escopo escrito (composer do Planejador). */
  generatePlan: (projectDir: string, prompt: string, mock?: boolean, models?: AgentModels, thinking?: AgentThinking, history?: PlanHistoryItem[]) => Promise<void>;
  /** Dispara a geração do grafo de conhecimento (graphify) no projectDir. */
  generateGraph: (projectDir: string, mock: boolean) => Promise<void>;
  /** E10 — garante que o processo engine existe (sem iniciar loop). Spawna se necessário. */
  ensureEngine: (projectDir: string, mock: boolean) => Promise<void>;
  /** Limpa o estado transitório do loop (planning/running/timeline) ao fechar o workspace. */
  reset: () => void;
}

export function useEngine(projectDir: string): { actions: EngineActions; notTauri: boolean } {
  const [notTauri, setNotTauri] = useState(false);

  // Reinicializa o store no mount/troca de workspace: limpa o estado transitório
  // do loop anterior e recarrega os acumuladores persistidos do workspace.
  useEffect(() => {
    dispatch({ type: "reset" });
    dispatch({ type: "setUsage", totals: loadUsageTotals(projectDir) });
  }, [projectDir]);

  // Persiste os acumuladores (tokens/custo) apenas quando mudam (agent-end) —
  // evita write no localStorage a cada flush de streaming.
  useEffect(() => {
    let lastTokens = getState().tokens;
    let lastCost = getState().cost;
    const unsub = subscribe(() => {
      const s = getState();
      if (s.tokens !== lastTokens || s.cost !== lastCost) {
        lastTokens = s.tokens;
        lastCost = s.cost;
        saveUsageTotals(projectDir, { tokens: s.tokens, cost: s.cost });
      }
    });
    return unsub;
  }, [projectDir]);

  // Buffer de streaming (2.2.4): deltas de token/thinking acumulam aqui e são
  // despachados em lote a cada STREAM_FLUSH_MS (ou antes de um evento não-stream).
  const streamBuf = useRef<Map<AgentRole, { text: string; thinking: string }>>(new Map());
  const streamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushStream = useCallback(() => {
    if (streamTimer.current) {
      clearTimeout(streamTimer.current);
      streamTimer.current = null;
    }
    const buf = streamBuf.current;
    if (buf.size === 0) return;
    streamBuf.current = new Map();
    for (const [role, d] of buf) {
      if (d.text) dispatch({ type: "event", ev: { type: "token", role, delta: d.text } });
      if (d.thinking) dispatch({ type: "event", ev: { type: "thinking", role, delta: d.thinking } });
    }
  }, []);

  // Timer do loop (2.2.3): +1s por tick enquanto roda/started.
  const ticking = useEngineSelector((s) => s.status === "running" || s.status === "starting");
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    const tauri = isTauri();
    dispatch({ type: "boot", tauri });
    if (!tauri) {
      setNotTauri(true);
      return;
    }
    setNotTauri(false);

    let disposed = false;
    const unlisteners: (() => void)[] = [];

    const handleEventLine = (line: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return;
      }
      const result = EngineEventSchema.safeParse(parsed);
      if (!result.success) return;
      const ev = result.data;
      // Streaming (2.2.4): token/thinking entram no buffer; a UI só re-renderiza
      // a cada STREAM_FLUSH_MS (ou antes de qualquer evento não-stream, que muda
      // o card — ex.: agent-end fecha o card com o conteúdo completo).
      if (ev.type === "token" || ev.type === "thinking") {
        const b = streamBuf.current.get(ev.role) ?? { text: "", thinking: "" };
        if (ev.type === "token") b.text += ev.delta;
        else b.thinking += ev.delta;
        streamBuf.current.set(ev.role, b);
        if (!streamTimer.current) {
          streamTimer.current = setTimeout(() => {
            streamTimer.current = null;
            flushStream();
          }, STREAM_FLUSH_MS);
        }
        return;
      }
      flushStream();
      dispatch({ type: "event", ev });
      handleEventDispatch(ev);
    };

    const handleLogLine = (line: string) => {
      dispatch({ type: "event", ev: { type: "log", level: "debug", message: `[stderr] ${line}` } });
    };

    const handleExit = () => {
      dispatch({ type: "event", ev: { type: "exit", code: null } });
    };

    void (async () => {
      const un1 = await onEngineEvent(handleEventLine);
      const un2 = await onEngineLog(handleLogLine);
      const un3 = await onEngineExit(handleExit);
      if (disposed) {
        un1();
        un2();
        un3();
        return;
      }
      unlisteners.push(un1, un2, un3);
    })();

    return () => {
      disposed = true;
      if (streamTimer.current) {
        clearTimeout(streamTimer.current);
        streamTimer.current = null;
      }
      unlisteners.forEach((u) => u());
    };
  }, []);

  const send = useCallback(async (cmd: EngineCommand) => {
    if (!isTauri()) return;
    try {
      await engineSend(cmd);
    } catch (err) {
      console.error("Falha ao enviar comando", err);
    }
  }, []);

  const actions: EngineActions = {
    start: useCallback(
      async (projectDir, mock, models, thinking) => {
        if (!isTauri()) return;
        try {
          // Mata qualquer engine anterior (pode ter sido spawnado com outro mock/projeto)
          // para garantir que o processo novo reflita as flags atuais.
          await engineStop().catch(() => undefined);
          await engineStart(projectDir, mock);
          await send({ type: "start", projectDir, models, thinking });
        } catch (err) {
          dispatch({ type: "event", ev: { type: "error", message: (err as Error).message } });
        }
      },
      [send],
    ),
    pause: useCallback(() => send({ type: "pause" }), [send]),
    resume: useCallback(() => send({ type: "resume" }), [send]),
    inject: useCallback((text) => send({ type: "inject", text }), [send]),
    stop: useCallback(async () => {
      await send({ type: "stop" });
      await engineStop().catch(() => undefined);
    }, [send]),
    crisisAccept: useCallback(() => send({ type: "crisis-accept" }), [send]),
    crisisRevert: useCallback(() => send({ type: "crisis-revert" }), [send]),
    generatePlan: useCallback(
      async (projectDir, prompt, mock = false, models, thinking, history) => {
        if (!isTauri()) return;
        try {
          // Mesmo cuidado do start: processo antigo pode estar com --mock de outra sessão.
          await engineStop().catch(() => undefined);
          await engineStart(projectDir, mock);
          await send({ type: "plan", projectDir, prompt, models, thinking, history });
        } catch (err) {
          dispatch({ type: "event", ev: { type: "error", message: (err as Error).message } });
        }
      },
      [send],
    ),
    generateGraph: useCallback(
      async (projectDir, mock) => {
        if (!isTauri()) return;
        try {
          // Garante que o engine está vivo antes de enviar o comando `graph`.
          await engineStop().catch(() => undefined);
          await engineStart(projectDir, mock);
          await send({ type: "graph", projectDir });
        } catch (err) {
          dispatch({ type: "event", ev: { type: "error", message: (err as Error).message } });
        }
      },
      [send],
    ),
    ensureEngine: useCallback(
      async (projectDir, mock) => {
        if (!isTauri()) return;
        try {
          // Mata qualquer engine anterior (pode ser de outro workspace ou mock).
          await engineStop().catch(() => undefined);
          await engineStart(projectDir, mock);
        } catch (err) {
          dispatch({ type: "event", ev: { type: "error", message: (err as Error).message } });
        }
      },
      [],
    ),
    reset: useCallback(() => {
      dispatch({ type: "reset" });
    }, []),
  };

  return { actions, notTauri };
}
