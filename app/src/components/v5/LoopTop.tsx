import { Clock, Coins, ListChecks, Square } from "lucide-react";
import { formatCost, formatTokens } from "../../lib/format";
import { Pipeline, type PipelineAgent } from "./Pipeline";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function LoopTop({
  planProgress,
  elapsed,
  tokens,
  cost,
  agents,
  running = false,
  onStop,
}: {
  planProgress: number;
  elapsed: number;
  tokens: number;
  cost: number;
  agents: PipelineAgent[];
  running?: boolean;
  onStop?: () => void;
}) {
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
        <button
          type="button"
          onClick={onStop}
          disabled={!running}
          className="inline-flex items-center gap-1 rounded-md border border-red-800 bg-red-950/30 px-2 py-1 text-[11px] font-medium text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square size={11} aria-hidden /> Parar
        </button>
      </div>
      {agents.length > 0 && <Pipeline agents={agents} />}
    </div>
  );
}
