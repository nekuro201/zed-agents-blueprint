import { cn } from "../../lib/cn";
import { Clock, FolderTree, Settings } from "lucide-react";
import { useEngineSelector } from "../../hooks/useEngine";
import { MemoryChip } from "./MemoryChip";

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

/**
 * Barra de status inferior (v5 → `.statusbar`). Presentacional.
 * Duas exceções assinadas direto (2.2.4/2.2.5): o `elapsed` (cronômetro do loop,
 * muda 1×/seg) e o `MemoryChip` (RSS dos processos, poll de 3s) — se viessem por
 * prop do App, re-renderizariam a árvore inteira a cada tick/poll.
 * No v7 ganha, à direita, o toggle do Explorer e o botão de Configurações —
 * que saíram da rail — ambos opcionais (só renderizam com o callback fornecido).
 */
export function StatusBar({
  motor,
  branch,
  fase,
  tokens,
  version,
  onToggleExplorer,
  explorerOpen = false,
  onOpenSettings,
}: {
  motor: MotorState;
  branch: string;
  fase: string;
  tokens: string;
  version: string;
  onToggleExplorer?: () => void;
  explorerOpen?: boolean;
  onOpenSettings?: () => void;
}) {
  const elapsed = useEngineSelector((s) => s.elapsed);
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
      {elapsed > 0 && (
        <span className="inline-flex items-center gap-1 font-mono text-amber-400/80">
          <Clock size={11} aria-hidden /> {elapsed}s
        </span>
      )}
      <span className="flex-1" />
      <MemoryChip />
      <span className="h-3 w-px bg-edge" />
      <span className="font-mono">{tokens}</span>
      <span className="h-3 w-px bg-edge" />
      <span className="font-mono">Pi · {version}</span>
      {onToggleExplorer && (
        <>
          <span className="h-3 w-px bg-edge" />
          <button
            type="button"
            title="Explorer"
            aria-label="Explorer"
            aria-pressed={explorerOpen}
            data-active={explorerOpen ? "true" : "false"}
            onClick={onToggleExplorer}
            className={cn(
              "grid h-5 w-5 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-surface hover:text-zinc-200",
              explorerOpen && "text-accent",
            )}
          >
            <FolderTree size={14} aria-hidden />
          </button>
        </>
      )}
      {onOpenSettings && (
        <>
          <span className="h-3 w-px bg-edge" />
          <button
            type="button"
            title="Configurações"
            aria-label="Configurações"
            onClick={onOpenSettings}
            className="grid h-5 w-5 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-surface hover:text-zinc-200"
          >
            <Settings size={14} aria-hidden />
          </button>
        </>
      )}
    </footer>
  );
}
