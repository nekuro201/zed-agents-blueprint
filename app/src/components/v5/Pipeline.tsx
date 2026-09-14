import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * Pipeline visual do loop (protótipo v5 → `.pipeline/.agent`).
 * Componente puramente apresentacional: recebe os agentes com seu estado e
 * renderiza a sequência Planejador → Techlead → Coder → Juiz TDD.
 *
 * DRY: `status` é normalizado no tipo (`done | active | idle`); classes de
 * aparência derivam apenas dele via `cn`.
 */
export type AgentStatus = "done" | "active" | "idle";

export interface PipelineAgent {
  id: string;
  label: string;
  icon: LucideIcon;
  model: string;
  status: AgentStatus;
}

const STATUS_OPACITY: Record<AgentStatus, string> = {
  active: "opacity-100",
  done: "opacity-75",
  idle: "opacity-40",
};

const STATUS_AVATAR: Record<AgentStatus, string> = {
  active:
    "border-accent text-accent shadow-[0_0_0_3px_rgba(245,158,11,0.12),0_0_18px_rgba(245,158,11,0.28)]",
  done: "border-emerald-800 text-emerald-400",
  idle: "border-edge text-muted",
};

export const Pipeline = memo(function Pipeline({ agents }: { agents: PipelineAgent[] }) {
  return (
    <div className="relative flex items-start justify-center gap-7 px-4 py-3.5">
      {/* linha de conexão atrás dos avatares (v5 .pipeline::before) */}
      <div
        className="absolute inset-x-[12%] top-7.5 h-px bg-linear-to-r from-transparent via-edge to-transparent"
        aria-hidden
      />
      {agents.map((agent) => (
        <div
          key={agent.id}
          data-status={agent.status}
          className={cn(
            "relative z-10 flex min-w-18 flex-col items-center gap-1.5 transition-[opacity,transform] duration-200",
            STATUS_OPACITY[agent.status],
            agent.status === "active" && "-translate-y-0.5",
          )}
        >
          <div className={cn("grid h-9 w-9 place-items-center rounded-full border bg-panel", STATUS_AVATAR[agent.status])}>
            <agent.icon size={16} strokeWidth={1.75} aria-hidden />
          </div>
          <b className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{agent.label}</b>
          <span className="rounded bg-black/40 px-1.5 py-px font-mono text-[9px] text-zinc-500">{agent.model}</span>
        </div>
      ))}
    </div>
  );
}, pipelineAgentsEqual);

/** Comparador por conteúdo (2.2.4): deltas de streaming não re-renderizam o
 * pipeline — só mudanças de status/modelo (agent-start/agent-end) disparam. */
function pipelineAgentsEqual(prev: { agents: PipelineAgent[] }, next: { agents: PipelineAgent[] }): boolean {
  if (prev.agents === next.agents) return true;
  const a = prev.agents;
  const b = next.agents;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x.id !== y.id || x.label !== y.label || x.status !== y.status || x.model !== y.model || x.icon !== y.icon) return false;
  }
  return true;
}
