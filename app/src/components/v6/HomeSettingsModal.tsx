import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { EnginePrefs } from "../../lib/enginePrefs";

export function HomeSettingsModal({
  open,
  prefs,
  onSave,
  onClose,
}: {
  open: boolean;
  prefs: EnginePrefs;
  onSave: (prefs: EnginePrefs) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(prefs);
  useEffect(() => {
    if (open) setDraft(prefs);
  }, [open, prefs]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(480px,calc(100vw-32px))] overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">Configurações</h3>
          <button type="button" aria-label="Fechar" onClick={onClose} className="grid h-7 w-7 place-items-center text-zinc-500">
            <X size={14} aria-hidden />
          </button>
        </header>
        <div className="grid gap-3 px-4 py-4">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={draft.mock} onChange={(e) => setDraft({ ...draft, mock: e.target.checked })} />
            Modo simulado
          </label>
          <label className="grid gap-1 text-[11px] font-semibold uppercase text-zinc-500">
            Modelo padrão
            <input
              value={draft.defaultModel}
              onChange={(e) => setDraft({ ...draft, defaultModel: e.target.value })}
              className="h-8 rounded-md border border-edge bg-surface px-2 font-mono text-xs font-normal normal-case text-zinc-100"
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-edge px-4 py-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950"
          >
            Salvar
          </button>
        </footer>
      </div>
    </div>
  );
}
