import { Play, SlidersHorizontal, type LucideIcon } from "lucide-react";

export interface SidebarAgent {
  id: string;
  label: string;
  icon: LucideIcon;
  model: string;
  thinking: string;
}

/**
 * Sidebar da thread: workspace + Iniciar Loop + roster + settings.
 */
export function Sidebar({
  agents,
  hasPlan = false,
  planComplete = false,
  onStart,
  onOpenSettings,
  activeLabel,
}: {
  agents: SidebarAgent[];
  hasPlan?: boolean;
  /** True quando o PLAN.md está 100% concluído — trava o Iniciar Loop. */
  planComplete?: boolean;
  onStart: () => void;
  onOpenSettings?: () => void;
  activeLabel: string;
}) {
  const startDisabled = !hasPlan || planComplete;
  return (
    <aside className="flex min-w-0 flex-col overflow-hidden border-r border-edge bg-panel/60">
      <div className="flex items-center justify-between gap-2 border-b border-edge px-3 py-2.5">
        <div className="min-w-0">
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Workspace ativo</div>
          <div className="truncate text-sm font-semibold text-zinc-100">{activeLabel}</div>
        </div>
        <button
          type="button"
          aria-label="Configurar thread"
          onClick={onOpenSettings}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-surface hover:text-amber-300"
        >
          <SlidersHorizontal size={14} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Orquestrador</div>
        <button
          type="button"
          onClick={onStart}
          disabled={startDisabled}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-linear-to-b from-amber-300 to-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 shadow-[0_8px_22px_rgba(212,175,55,0.18)] transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play size={14} aria-hidden /> Iniciar Loop
        </button>
        {planComplete && (
          <p className="text-[10px] leading-snug text-emerald-400">
            PLAN.md concluído — todas as fases foram entregues. Gere um novo plano na Chat da Thread se quiser continuar.
          </p>
        )}
        {!hasPlan && !planComplete && (
          <p className="text-[10px] leading-snug text-zinc-500">
            Sem PLAN.md. Gere o plano na Chat da Thread antes de iniciar.
          </p>
        )}

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
