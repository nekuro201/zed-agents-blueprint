import { TriangleAlert, X } from "lucide-react";

/**
 * Modal de confirmação para sair do workspace durante uma execução em andamento.
 * Evita perder um loop/planejador no meio sem aviso.
 */
export function ConfirmExitModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-[min(480px,calc(100vw-32px))] overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-edge bg-surface/60 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <TriangleAlert size={15} className="text-amber-400" aria-hidden /> Sair do workspace?
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 hover:bg-surface hover:text-zinc-200"
          >
            <X size={14} aria-hidden />
          </button>
        </header>

        <div className="px-4 py-4 text-sm leading-relaxed text-zinc-300">
          Há uma <b className="text-zinc-100">execução em andamento</b>. Se sair agora, o processo será{" "}
          <b className="text-red-400">abortado</b> e o progresso não salvo será perdido.
        </div>

        <footer className="flex justify-end gap-2 border-t border-edge bg-surface/60 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3.5 py-1.5 text-sm text-zinc-300 hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Abortar e sair
          </button>
        </footer>
      </div>
    </div>
  );
}
