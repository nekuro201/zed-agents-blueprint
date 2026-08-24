import { Clock, Coins, ListChecks, Loader2, Play, Square } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatCost, formatTokens } from "../../lib/format";
import { Pipeline, type PipelineAgent } from "./Pipeline";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

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
  running?: boolean;
  aborting?: boolean;
  onStart?: () => void;
  onStop?: () => void;
}) {
  const startDisabled = !hasPlan || planComplete;

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
          <Clock size={11} aria-hidden /> {formatElapsed(elapsed)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[11px] text-amber-300">
          <Coins size={11} aria-hidden /> {formatTokens(tokens)} · {formatCost(cost)}
        </span>
        <LoopCta
          running={running}
          aborting={aborting}
          startDisabled={startDisabled}
          onStart={onStart}
          onStop={onStop}
        />
      </div>
      {agents.length > 0 && <Pipeline agents={agents} />}
    </div>
  );
}
