import { Clock, MessageSquare, Plus, Trash2, X } from "lucide-react";
import type { Conversation } from "../../lib/conversations";
import { cn } from "../../lib/cn";
import { formatRelativeTime } from "../../lib/format";

/**
 * Modal de Histórico da Thread (v7 → `#modal-history`).
 * Lista as conversas do workspace ativo + ação "Nova sessão (limpa contexto)".
 */
export function HistoryModal({
  open,
  conversations,
  activeId,
  onActivate,
  onNew,
  onDelete,
  onClose,
}: {
  open: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-edge bg-surface/60 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Clock size={14} aria-hidden /> Histórico da Thread
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 hover:bg-surface hover:text-zinc-200"
          >
            <X size={14} aria-hidden />
          </button>
        </header>

        <div className="px-4 py-3">
          <button
            type="button"
            onClick={onNew}
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-linear-to-b from-amber-300 to-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 transition-transform active:translate-y-px"
          >
            <Plus size={14} aria-hidden /> Nova sessão (limpa contexto)
          </button>

          <div className="flex max-h-[55vh] flex-col gap-1.5 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="py-6 text-center text-sm text-zinc-600">Nenhuma conversa ainda.</div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg border px-3 py-2",
                    c.id === activeId ? "border-accent/40 bg-accent/10" : "border-edge bg-surface/40 hover:bg-surface",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onActivate(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <MessageSquare size={13} className="shrink-0 text-zinc-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-zinc-100">{c.label || "Nova conversa"}</div>
                      <div className="text-[10px] text-zinc-500">
                        {c.messages.length} msgs · {formatRelativeTime(c.createdAt)}
                      </div>
                    </div>
                    {c.id === activeId && (
                      <span className="shrink-0 rounded bg-accent/20 px-1.5 py-px text-[9px] font-bold text-amber-300">ativa</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    title="Excluir conversa"
                    aria-label={`Excluir ${c.label || "Nova conversa"}`}
                    className="shrink-0 rounded-md p-1 text-zinc-600 opacity-0 transition-colors hover:bg-red-950/40 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
