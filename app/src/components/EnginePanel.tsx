import { useCallback } from "react";
import { useEngineState, type EngineActions } from "../hooks/useEngine";
import type { ProjectDocs } from "../hooks/useProjectDocs";
import { ArrowLeft, CheckCircle2, GitGraph, TriangleAlert } from "lucide-react";
import { LoopTerminal } from "./v5/LoopTerminal";
import { DocInspectorPane } from "./v5/DocInspectorPane";
import { LoopTop } from "./v5/LoopTop";
import { pipelineFromTimeline } from "../lib/pipeline";
import { aggregateTelemetry } from "../lib/telemetry";

/**
 * Painel do Loop v5: loop-top (arts + pipeline) + work (terminal | inspector).
 * `docs` vem do App (fonte única) para o inspector refletir o andamento do loop.
 * O estado do engine é assinado direto do store (2.2.4): o painel re-renderiza
 * a cada mudança porque exibe o terminal em tempo real — as views inativas não.
 * Quando `completed` (todas as fases do PLAN.md concluídas), mostra a CTA de
 * voltar para o Chat da Thread (como o `.done-cta` do protótipo v5).
 */
export function EnginePanel({
  notTauri,
  docs,
  planProgress = 0,
  hasPlan,
  planComplete,
  projectDir,
  aborting = false,
  actions,
  onStart,
  onStop,
  onRegenerateGraph,
  onBackToChat,
}: {
  notTauri: boolean;
  docs: ProjectDocs;
  planProgress?: number;
  hasPlan: boolean;
  planComplete: boolean;
  /** Path do workspace aberto (sessão) — usado no gatilho do grafo antes do engine conectar. */
  projectDir?: string;
  aborting?: boolean;
  /** E4 — actions para o card de crise (crisisAccept/crisisRevert). */
  actions?: Pick<EngineActions, "crisisAccept" | "crisisRevert">;
  onStart?: () => void;
  onStop?: () => void;
  onRegenerateGraph?: () => void;
  onBackToChat?: () => void;
}) {
  const state = useEngineState();
  const crisisActive = state.status === "waiting" && state.stage === "crisis";

  // Callback estável (memo do LoopTerminal): o foco no inspector é no-op nesta
  // versão (o inspector é somente leitura e já fica ao lado do terminal).
  const focusInspector = useCallback(() => {}, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {notTauri && (
        <div className="flex items-center gap-2 border-b border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          <TriangleAlert size={14} aria-hidden />
          <span>Você está abrindo a UI fora do Tauri (navegador). O motor (Rust + Node) não está
          disponível. Rode via <code className="mx-1 rounded bg-zinc-900 px-1.5 py-0.5 font-mono">pnpm tauri dev</code>.</span>
        </div>
      )}

      {state.completed && (
        <div className="flex items-center justify-between gap-3 border-b border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 size={14} aria-hidden /> Planos concluídos — todas as fases do PLAN.md foram entregues.
          </span>
          {onBackToChat && (
            <button
              type="button"
              onClick={onBackToChat}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-700 bg-emerald-900/40 px-2.5 py-1 font-semibold text-emerald-200 transition-colors hover:bg-emerald-800/50"
            >
              <ArrowLeft size={12} aria-hidden /> Voltar para o Chat da Thread
            </button>
          )}
        </div>
      )}

      <LoopTop
        planProgress={planProgress}
        elapsed={state.elapsed}
        tokens={state.tokens.total}
        cost={state.cost}
        agents={pipelineFromTimeline(state.timeline)}
        perAgent={aggregateTelemetry(state.timeline)}
        stage={state.stage}
        status={state.status}
        running={state.running}
        hasPlan={hasPlan}
        planComplete={planComplete}
        aborting={aborting}
        onStart={onStart}
        onStop={onStop}
      />

      {(projectDir || state.projectDir) && onRegenerateGraph && (
        <div className="flex items-center justify-end border-b border-edge bg-[#161616] px-3 py-1.5">
          <button
            type="button"
            onClick={onRegenerateGraph}
            title="Regenerar grafo de conhecimento (graphify)"
            className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-panel px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            <GitGraph size={13} aria-hidden /> Regenerar grafo
          </button>
        </div>
      )}

      {state.error && (
        <div className="border-b border-red-900 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-300">
          {state.error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 overflow-hidden">
          <LoopTerminal
            items={state.timeline}
            crisisActive={crisisActive}
            onCrisisAccept={actions?.crisisAccept}
            onCrisisRevert={actions?.crisisRevert}
            onFocusInspector={focusInspector}
          />
        </div>
        <DocInspectorPane docs={docs} />
      </div>
    </div>
  );
}
