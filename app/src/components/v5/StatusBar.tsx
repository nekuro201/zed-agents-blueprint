import { cn } from "../../lib/cn";
import { Clock } from "lucide-react";

export type MotorState = "idle" | "on" | "run";

const DOT: Record<MotorState, string> = {
  idle: "bg-zinc-600",
  on: "bg-emerald-400",
  run: "bg-amber-400 animate-pulse",
};

const LABEL: Record<MotorState, string> = {
  idle: "ocioso",
  on: "conectado",
  run: "ativo",
};

/** Barra de status inferior (v5 → `.statusbar`). Presentacional. */
export function StatusBar({
  motor,
  branch,
  fase,
  tokens,
  version,
  elapsed,
}: {
  motor: MotorState;
  branch: string;
  fase: string;
  tokens: string;
  version: string;
  elapsed?: string;
}) {
  return (
    <footer className="flex select-none items-center gap-3 border-t border-edge bg-panel px-3.5 py-1.5 text-[11px] text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span data-state={motor} className={cn("h-1.5 w-1.5 rounded-full", DOT[motor])} />
        Motor {LABEL[motor]}
      </span>
      <span className="h-3 w-px bg-edge" />
      <span className="font-mono">{branch}</span>
      <span className="h-3 w-px bg-edge" />
      <span className="truncate">{fase}</span>
      {elapsed && (
        <span className="inline-flex items-center gap-1 font-mono text-amber-400/80">
          <Clock size={11} aria-hidden /> {elapsed}
        </span>
      )}
      <span className="flex-1" />
      <span className="font-mono">{tokens}</span>
      <span className="h-3 w-px bg-edge" />
      <span className="font-mono">Pi · {version}</span>
    </footer>
  );
}
