import { Play, Square, type LucideIcon } from "lucide-react";

export interface SidebarAgent {
  id: string;
  label: string;
  icon: LucideIcon;
  model: string;
  thinking: string;
}

/**
 * Sidebar (v5 → `.sidebar`): workspace ativo + orquestrador (Iniciar/Abortar)
 * + roster dos agentes com modelo/thinking (valores manuais — campos vêm no 2.1.3).
 */
export function Sidebar({
  agents,
  running,
  onStart,
  onAbort,
  activeLabel,
}: {
  agents: SidebarAgent[];
  running: boolean;
  onStart: () => void;
  onAbort: () => void;
  activeLabel: string;
}) {
  return (
    <aside className="flex min-w-0 flex-col overflow-hidden border-r border-edge bg-panel/60">
      <div className="border-b border-edge px-3 py-2.5">
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Workspace ativo</div>
        <div className="truncate text-sm font-semibold text-zinc-100">{activeLabel}</div>
      </div>

      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Orquestrador</div>
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-linear-to-b from-amber-300 to-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 shadow-[0_8px_22px_rgba(212,175,55,0.18)] transition-transform active:translate-y-px"
        >
          <Play size={14} aria-hidden /> Iniciar Loop
        </button>
        <button
          type="button"
          onClick={onAbort}
          disabled={!running}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-red-800 bg-red-950/20 px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square size={12} aria-hidden /> Abortar
        </button>

        <div className="mt-2 flex flex-col gap-1.5">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-md border border-edge bg-surface/50 px-2 py-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-200">
                <agent.icon size={14} aria-hidden />
                {agent.label}
              </div>
              <div className="mt-0.5 grid grid-cols-2 gap-x-2 text-[10px] text-zinc-500">
                <span>modelo</span>
                <span className="truncate text-right font-mono text-amber-400">{agent.model}</span>
                <span>thinking</span>
                <span className="text-right font-mono text-amber-400">{agent.thinking}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
