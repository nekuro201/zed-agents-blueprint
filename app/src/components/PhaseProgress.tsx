import { Target } from "lucide-react";

export function PhaseProgress({
  fase,
  total,
  done,
  pct,
}: {
  fase: string | null;
  total: number;
  done: number;
  pct: number;
}) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium text-zinc-200">
          {fase ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-accent">
                <Target size={13} aria-hidden /> Fase ativa:
              </span>{" "}
              {fase}
            </>
          ) : (
            <span className="text-zinc-500">Sem fase ativa</span>
          )}
        </span>
        <span className="shrink-0 font-mono text-xs text-zinc-400">
          {done}/{total} · {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-linear-to-r from-accent to-amber-300 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
