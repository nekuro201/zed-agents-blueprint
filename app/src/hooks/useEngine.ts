import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { engineSend, engineStart, engineStop, isTauri, onEngineEvent, onEngineExit, onEngineLog } from "../lib/engine";
import { EngineEventSchema, type AgentModels, type AgentRole, type EngineCommand, type EngineEvent, type EngineStatus } from "../lib/protocol";

export type ToolEvent = { tool: string; args: string; ok?: boolean; summary?: string };

export type TimelineItem =
  | { id: number; kind: "phase"; fase: string; order: number }
  | {
      id: number;
      kind: "agent";
      role: AgentRole;
      model?: string;
      attempt?: number;
      maxAttempts?: number;
      ended: boolean;
      thinking: string;
      text: string;
      stats?: { tokens: { input: number; output: number; total: number }; cost: number };
      tools: ToolEvent[];
    }
  | { id: number; kind: "test"; state: "start" | "ok" | "fail"; output: string }
  | { id: number; kind: "qa"; veredito: "ESPERADO" | "INESPERADO"; justificativa?: string }
  | { id: number; kind: "commit"; ok: boolean; message?: string }
  | { id: number; kind: "crisis"; message: string }
  | { id: number; kind: "injected"; text: string }
  | { id: number; kind: "log"; level: "info" | "warn" | "error"; message: string }
  | { id: number; kind: "status"; message: string; sub?: string };

export interface EngineUiState {
  tauri: boolean;
  connected: boolean;
  mock: boolean;
  version: string | null;
  status: EngineStatus | "idle" | "offline";
  detail?: string;
  running: boolean;
  /** Verdadiero quando o loop terminou com TODAS as fases do PLAN.md concluídas. */
  completed: boolean;
  /** 2.2.3 — duração do loop e acumuladores reais de tokens/custo. */
  elapsed: number;
  tokens: { input: number; output: number; total: number };
  cost: number;
  projectDir: string | null;
  phase: { fase: string | null; total: number; done: number; pct: number } | null;
  error: string | null;
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
  projectDir: null,
  phase: null,
  error: null,
  graphStatus: "empty",
  graphError: null,
  timeline: [],
  planning: false,
};

export { initialState };

let nextId = 1;

export type Action = { type: "event"; ev: EngineEvent } | { type: "tick" } | { type: "boot"; tauri: boolean };

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
      // `planning` é SÓ a geração do plano (composer). O "Lendo PLAN.md…" do início
      // do loop NÃO conta como planning — senão travava e bloqueava o reload dos docs.
      const planning = ev.status === "starting" && (ev.detail?.includes("gerando o PLAN.md") ?? false);
      if (ev.status === "starting") {
        // Novo loop ou nova geração: reseta o estado de conclusão e os acumuladores.
        return { ...base, elapsed: 0, tokens: { input: 0, output: 0, total: 0 }, cost: 0, completed: false, planning };
      }
      return { ...base, planning: planning || (ev.status === "idle" ? false : state.planning) };
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
            { id: nextId++, kind: "agent", role: ev.role, model: ev.model, attempt: ev.attempt, maxAttempts: ev.maxAttempts, ended: false, thinking: "", text: "", tools: [] },
          ],
        };
      }
      return withItem({ id: nextId++, kind: "agent", role: ev.role, model: ev.model, attempt: ev.attempt, maxAttempts: ev.maxAttempts, ended: false, thinking: "", text: "", tools: [] });
    }

    case "token":
      return patchAgent((a) => ({ ...a, text: a.text + ev.delta }));

    case "thinking":
      return patchAgent((a) => ({ ...a, thinking: a.thinking + ev.delta }));

    case "agent-message":
      return ev.kind === "thinking"
        ? patchAgent((a) => ({ ...a, thinking: a.thinking + ev.text }))
        : patchAgent((a) => ({ ...a, text: a.text + ev.text }));

    case "tool-call":
      return patchAgent((a) => ({ ...a, tools: [...a.tools, { tool: ev.tool, args: ev.args }] }));

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
      const base = patchAgent((a) => ({ ...a, ended: true, stats: ev.stats }));
      if (!ev.stats) return base;
      return {
        ...base,
        tokens: {
          input: base.tokens.input + ev.stats.tokens.input,
          output: base.tokens.output + ev.stats.tokens.output,
          total: base.tokens.total + ev.stats.tokens.total,
        },
        cost: base.cost + ev.stats.cost,
      };
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
      return { ...withItem({ id: nextId++, kind: "crisis", message: ev.message }), error: null };

    case "injected":
      return withItem({ id: nextId++, kind: "injected", text: ev.text });

    case "paused":
      return { ...setStatus("waiting", "Pausado pelo usuário"), timeline: [...tl, { id: nextId++, kind: "status", message: "⏸ Pausado — aguardando retomada" }] };

    case "resumed":
      return { ...setStatus("running"), timeline: [...tl, { id: nextId++, kind: "status", message: "▶ Retomado", sub: "Fluxo continuando…" }] };

    case "log":
      if (ev.level === "debug") return state;
      return withItem({ id: nextId++, kind: "log", level: ev.level, message: ev.message });

    case "error":
      return { ...setStatus("error"), error: ev.message, planning: false, timeline: [...tl, { id: nextId++, kind: "status", message: `❌ ${ev.message}` }] };

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

export function reducer(state: EngineUiState, action: Action): EngineUiState {
  const next = reduceUncapped(state, action);
  if (next.timeline.length > MAX_TIMELINE_ITEMS) {
    return { ...next, timeline: next.timeline.slice(-MAX_TIMELINE_ITEMS) };
  }
  return next;
}

export interface EngineActions {
  start: (projectDir: string, mock: boolean, models?: AgentModels) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  inject: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  /** Pede ao engine para gerar o PLAN.md a partir do escopo escrito (composer do Planejador). */
  generatePlan: (projectDir: string, prompt: string, mock?: boolean, models?: AgentModels) => Promise<void>;
  /** Dispara a geração do grafo de conhecimento (graphify) no projectDir. */
  generateGraph: (projectDir: string, mock: boolean) => Promise<void>;
}

export function useEngine(): { state: EngineUiState; actions: EngineActions; notTauri: boolean } {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [notTauri, setNotTauri] = useState(false);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // Timer do loop (2.2.3): enquanto roda/started, +1s por tick.
  const ticking = state.status === "running" || state.status === "starting";
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => dispatchRef.current({ type: "tick" }), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    const tauri = isTauri();
    dispatchRef.current({ type: "boot", tauri });
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
      if (result.success) {
        dispatchRef.current({ type: "event", ev: result.data });
      }
    };

    const handleLogLine = (line: string) => {
      dispatchRef.current({ type: "event", ev: { type: "log", level: "debug", message: `[stderr] ${line}` } });
    };

    const handleExit = () => {
      dispatchRef.current({ type: "event", ev: { type: "exit", code: null } });
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
      async (projectDir, mock, models) => {
        if (!isTauri()) return;
        try {
          // Mata qualquer engine anterior (pode ter sido spawnado com outro mock/projeto)
          // para garantir que o processo novo reflita as flags atuais.
          await engineStop().catch(() => undefined);
          await engineStart(projectDir, mock);
          await send({ type: "start", projectDir, models });
        } catch (err) {
          dispatchRef.current({ type: "event", ev: { type: "error", message: (err as Error).message } });
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
    generatePlan: useCallback(
      async (projectDir, prompt, mock = false, models) => {
        if (!isTauri()) return;
        try {
          // Mesmo cuidado do start: processo antigo pode estar com --mock de outra sessão.
          await engineStop().catch(() => undefined);
          await engineStart(projectDir, mock);
          await send({ type: "plan", projectDir, prompt, models });
        } catch (err) {
          dispatchRef.current({ type: "event", ev: { type: "error", message: (err as Error).message } });
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
          dispatchRef.current({ type: "event", ev: { type: "error", message: (err as Error).message } });
        }
      },
      [send],
    ),
  };

  return { state, actions, notTauri };
}
