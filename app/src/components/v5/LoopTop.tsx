import { Clock, Coins, ListChecks, Loader2, Play, Square, FileText, Brain, Code, FlaskConical, Scale, TriangleAlert, Package, GitGraph, BookOpenCheck } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatCost, formatDuration, formatTokens } from "../../lib/format";
import { ROLE_COLOR, ROLE_LABEL } from "../../lib/roles";
import { AGENT_ROLES, type PerAgentTelemetry } from "../../lib/telemetry";
import { Pipeline, type PipelineAgent } from "./Pipeline";

/**
 * CTA de início/aborto do loop (protótipo v7 → `.loop-cta`). Um único botão que
 * alterna entre "Iniciar Loop" (dourado), "Abortar Loop" (vermelho) e o estado
 * "Abortando…" (spinner) — substitui o modal Orquestrador como gatilho do loop.
 */
function LoopCta({
  running,
  aborting,
  startDisabled,
  onStart,
  onStop,
}: {
  running: boolean;
  aborting: boolean;
  startDisabled: boolean;
  onStart?: () => void;
  onStop?: () => void;
}) {
  const base =
    "inline-flex h-8 items-center gap-2 rounded-lg px-4 text-[12.5px] font-bold transition-[transform,box-shadow,background,color] duration-200 active:translate-y-px";
  const idle =
    "bg-linear-to-b from-[#e2c25a] to-accent text-[#1a1a1a] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_22px_rgba(212,175,55,0.22)] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_12px_30px_rgba(212,175,55,0.34)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_22px_rgba(212,175,55,0.22)]";
  const runningCls =
    "bg-red-950/40 text-red-200 shadow-[0_0_0_1px_rgba(232,93,93,0.4),0_0_20px_rgba(232,93,93,0.16)] hover:shadow-[0_0_0_1px_rgba(232,93,93,0.55),0_0_30px_rgba(232,93,93,0.26)]";

  if (aborting) {
    return (
      <button type="button" disabled className={cn(base, runningCls, "cursor-not-allowed")}>
        <Loader2 size={13} aria-hidden className="animate-spin" /> Abortando…
      </button>
    );
  }

  if (running) {
    return (
      <button type="button" onClick={onStop} title="Abortar loop" className={cn(base, runningCls)}>
        <Square size={12} aria-hidden /> Abortar Loop
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onStart}
      disabled={startDisabled}
      title="Iniciar loop"
      className={cn(base, idle)}
    >
      <Play size={13} aria-hidden /> Iniciar Loop
    </button>
  );
}

export function LoopTop({
  planProgress,
  elapsed,
  tokens,
  cost,
  agents,
  hasPlan,
  planComplete,
  perAgent,
  stage,
  status,
  running = false,
  aborting = false,
  onStart,
  onStop,
}: {
  planProgress: number;
  elapsed: number;
  tokens: number;
  cost: number;
  agents: PipelineAgent[];
  hasPlan: boolean;
  planComplete: boolean;
  perAgent?: PerAgentTelemetry;
  stage?: string;
  status?: string;
  running?: boolean;
  aborting?: boolean;
  onStart?: () => void;
  onStop?: () => void;
}) {
  const startDisabled = !hasPlan || planComplete;
  // Custo zerado com tokens > 0 indica que o preço do modelo não está
  // configurado em ~/.pi/agent/models.json (o SDK calcula o custo localmente).
  const costMissing = tokens > 0 && cost === 0;

  const STAGE_LABELS: Record<string, { label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
    "reading-plan": { label: "Lendo PLAN", Icon: FileText },
    "techlead": { label: "Techlead", Icon: Brain },
    "coder": { label: "Coder", Icon: Code },
    "testador": { label: "Testador", Icon: FlaskConical },
    "qa": { label: "QA", Icon: Scale },
    "crisis": { label: "Crise", Icon: TriangleAlert },
    "commit": { label: "Commit", Icon: Package },
    "graph": { label: "Grafo", Icon: GitGraph },
    "plan": { label: "Planejador", Icon: BookOpenCheck },
  };
  const stageInfo = stage ? STAGE_LABELS[stage] : null;

  return (
    <div className="border-b border-edge bg-[#161616]">
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <span className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-400/10 px-2.5 py-1 text-xs text-zinc-100 transition-colors hover:border-amber-400">
          <ListChecks size={12} aria-hidden /> PLAN.md
          <span className="h-0.75 w-10.5 overflow-hidden rounded-full bg-black">
            <i
              data-testid="plan-bar"
              className="block h-full bg-amber-400 transition-[width] duration-300"
              style={{ width: `${planProgress}%` }}
            />
          </span>
        </span>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-panel px-2.5 py-0.5 font-mono text-[11px] text-zinc-300">
          <Clock size={11} aria-hidden /> {formatDuration(elapsed * 1000)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[11px] text-amber-300">
          <Coins size={11} aria-hidden /> {formatTokens(tokens)} · {formatCost(cost)}
        </span>
        {costMissing && (
          <span
            title="Custo zerado: o preço (cost) do modelo não está configurado em ~/.pi/agent/models.json. O SDK calcula o custo localmente a partir do preço do modelo (USD por milhão de tokens)."
            className="inline-flex items-center gap-1 rounded-full border border-amber-700/50 bg-amber-950/30 px-2 py-0.5 font-mono text-[10px] text-amber-300"
          >
            <TriangleAlert size={10} aria-hidden /> preço não configurado
          </span>
        )}
        <LoopCta
          running={running}
          aborting={aborting}
          startDisabled={startDisabled}
          onStart={onStart}
          onStop={onStop}
        />
      </div>
      {perAgent && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-edge px-3 py-1.5">
          {AGENT_ROLES.map((role) => {
            const t = perAgent[role];
            if (t.tokens.total === 0 && t.cost === 0 && t.durationMs === 0) return null;
            return (
              <span
                key={role}
                className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-panel px-2 py-0.5 font-mono text-[10px]"
              >
                <span className={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</span>
                <span className="text-zinc-700">·</span>
                <span className="inline-flex items-center gap-0.5 text-zinc-400">
                  <Clock size={9} aria-hidden /> {formatDuration(t.durationMs)}
                </span>
                <span className="text-zinc-700">·</span>
                <span className="text-zinc-400">{formatTokens(t.tokens.total)} tok</span>
                <span className="text-zinc-700">·</span>
                <span className="text-amber-400/70">{formatCost(t.cost)}</span>
              </span>
            );
          })}
        </div>
      )}
      {stageInfo && (
        <div className={cn(
          "flex items-center gap-2 border-b px-3 py-1",
          status === "waiting" && stage === "crisis"
            ? "border-amber-700/60 bg-amber-950/40"
            : "border-amber-500/30 bg-amber-400/5"
        )}>
          <stageInfo.Icon size={12} className={status === "waiting" && stage === "crisis" ? "text-amber-300" : "text-amber-400"} aria-hidden />
          <span className={cn("text-[11px] font-semibold", status === "waiting" && stage === "crisis" ? "text-amber-200" : "text-amber-300")}>
            {status === "waiting" && stage === "crisis" ? `${stageInfo.label} — aguardando decisão` : stageInfo.label}
          </span>
        </div>
      )}
      {agents.length > 0 && <Pipeline agents={agents} />}
    </div>
  );
}
