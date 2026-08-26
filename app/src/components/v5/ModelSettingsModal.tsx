import { useEffect, useRef, useState } from "react";
import { RefreshCw, Clock } from "lucide-react";
import { AGENT_KEYS } from "../../lib/agents";
import { ROLE_LABEL } from "../../lib/roles";
import type { AgentModelConfig } from "../../lib/modelConfig";
import { cn } from "../../lib/cn";
import { ModelSearchSelect } from "./ModelSearchSelect";
import { useModelList, refreshModelList, registerModel } from "../../hooks/useModelList";
import { formatRelativeTime } from "../../lib/format";

const FALLBACK_THINKING_LEVELS = ["off", "low", "medium", "high", "max"];

/**
 * Modal "Modelos da Thread" (v5 → `#modal-settings`).
 * Campos MANUAIS (texto) de modelo e thinking por agente — COM seletor de busca
 * opcional (E10) que consulta a API do llmgateway.
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
  const { models, loading: modelsLoading, error: modelsError, lastUpdatedMs } = useModelList();
  const [now, setNow] = useState(Date.now());

  // Atualiza o "agora" a cada 30s para o texto relativo não ficar stale
  // enquanto o modal está aberto.
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    timer.current = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer.current);
  }, [open]);
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
  const selectCls =
    "h-8 w-full appearance-none rounded-md border border-edge bg-surface px-2 text-xs text-zinc-100 outline-none focus:border-accent [&>option]:bg-panel [&>option]:text-zinc-100";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(720px,calc(100vw-32px))] overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
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
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              Cada agente usa modelo e thinking próprios. Use o botão 🔍 para buscar no llmgateway ou digite manualmente.
            </p>
            <div className="flex flex-col items-end gap-0.5">
              <button
                type="button"
                onClick={() => refreshModelList()}
                disabled={modelsLoading}
                title="Atualizar lista de modelos do llmgateway"
                className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-50"
              >
                <RefreshCw size={11} aria-hidden className={modelsLoading ? "animate-spin" : ""} />
                Atualizar
              </button>
              {lastUpdatedMs > 0 && (
                <span
                  title={`Última atualização: ${new Date(lastUpdatedMs).toLocaleString()}`}
                  className="inline-flex items-center gap-1 text-[10px] text-zinc-600"
                >
                  <Clock size={10} aria-hidden /> {formatRelativeTime(lastUpdatedMs, now)}
                </span>
              )}
            </div>
          </div>
          {modelsError && (
            <div className="mb-3 rounded-md border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
              Não foi possível carregar a lista de modelos do llmgateway. O seletor de busca estará limitado. Erro: {modelsError}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {AGENT_KEYS.map((key) => (
              <div
                key={key}
                className="grid grid-cols-[110px_28px_1fr_120px] items-center gap-2 rounded-lg border border-edge bg-surface/40 p-2"
              >
                <span className="text-xs font-semibold text-zinc-100">{ROLE_LABEL[key]}</span>
                <ModelSearchSelect
                  value={draft[key].model}
                  onChange={(model) => setField(key, "model", model)}
                  onRegister={registerModel}
                  models={models}
                />
                <input
                  aria-label={`modelo do ${ROLE_LABEL[key].toLowerCase()}`}
                  value={draft[key].model}
                  onChange={(e) => setField(key, "model", e.target.value)}
                  className={inputCls}
                  placeholder="provider/modelo"
                  spellCheck={false}
                />
                {(() => {
                  const selected = models.find((m) => m.id === draft[key].model);
                  const efforts = selected?.reasoningEfforts?.length ? selected.reasoningEfforts : FALLBACK_THINKING_LEVELS;
                  const options = [...new Set([...efforts, ...(efforts.includes(draft[key].thinking) ? [] : [draft[key].thinking])])];
                  return (
                    <select
                      aria-label={`thinking do ${ROLE_LABEL[key].toLowerCase()}`}
                      value={draft[key].thinking}
                      onChange={(e) => setField(key, "thinking", e.target.value)}
                      className={selectCls}
                    >
                      {options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  );
                })()}
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
