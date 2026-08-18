import { useEffect, useState } from "react";
import { AGENT_KEYS, AGENT_META } from "../../lib/agents";
import type { AgentModelConfig } from "../../lib/modelConfig";
import { cn } from "../../lib/cn";

/**
 * Modal "Modelos da Thread" (v5 → `#modal-settings`).
 * Campos MANUAIS (texto) de modelo e thinking por agente — sem dropdown.
 * Validado: Salvar fica desabilitado enquanto algum campo estiver vazio.
 */
export function ModelSettingsModal({
  open,
  config,
  onSave,
  onClose,
}: {
  open: boolean;
  config: AgentModelConfig;
  onSave: (config: AgentModelConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AgentModelConfig>(config);

  // Ao abrir, sincroniza o rascunho com o config atual.
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const valid = AGENT_KEYS.every((key) => draft[key].model.trim() !== "" && draft[key].thinking.trim() !== "");

  if (!open) return null;

  const setField = (key: keyof AgentModelConfig, field: "model" | "thinking", value: string) => {
    setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));
  };

  const inputCls =
    "h-8 w-full rounded-md border border-edge bg-surface px-2 text-xs text-zinc-100 outline-none focus:border-accent";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-edge bg-surface/60 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">Modelos da Thread</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 hover:bg-surface hover:text-zinc-200"
          >
            ✕
          </button>
        </header>

        <div className="px-4 py-3">
          <p className="mb-3 text-xs text-zinc-500">
            Cada agente usa modelo e thinking próprios (campos manuais). O loop herda estes valores.
          </p>
          <div className="flex flex-col gap-2">
            {AGENT_KEYS.map((key) => (
              <div
                key={key}
                className="grid grid-cols-[110px_1fr_120px] items-center gap-2 rounded-lg border border-edge bg-surface/40 p-2"
              >
                <span className="text-xs font-semibold text-zinc-100">{AGENT_META[key].label}</span>
                <input
                  aria-label={`modelo do ${AGENT_META[key].label.toLowerCase()}`}
                  value={draft[key].model}
                  onChange={(e) => setField(key, "model", e.target.value)}
                  className={inputCls}
                  placeholder="provider/modelo"
                  spellCheck={false}
                />
                <input
                  aria-label={`thinking do ${AGENT_META[key].label.toLowerCase()}`}
                  value={draft[key].thinking}
                  onChange={(e) => setField(key, "thinking", e.target.value)}
                  className={inputCls}
                  placeholder="opção de thinking"
                />
              </div>
            ))}
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-edge bg-surface/60 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3.5 py-1.5 text-sm text-zinc-300 hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            disabled={!valid}
            className={cn(
              "rounded-md bg-linear-to-b from-amber-300 to-amber-500 px-3.5 py-1.5 text-sm font-semibold text-zinc-950",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            Salvar
          </button>
        </footer>
      </div>
    </div>
  );
}
