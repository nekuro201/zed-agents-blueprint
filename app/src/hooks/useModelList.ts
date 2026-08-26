import { useEffect, useRef, useState } from "react";
import { engineSend } from "../lib/engine";
import type { EngineEvent } from "../lib/protocol";

/**
 * Hook que expõe a lista de modelos catalogados do llmgateway (E10 — Fase 2).
 *
 * Dispara o comando `models-list` no engine e escuta `models-list-result`.
 * O estado é compartilhável (a lista é a mesma para todos os seletores).
 */

export interface ListedModel {
  id: string;
  name: string;
  provider: string;
  pricing: { prompt: number; completion: number } | null;
  reasoningEfforts?: string[];
}

interface State {
  models: ListedModel[];
  loading: boolean;
  error: string | null;
  /** Timestamp (ms) da última atualização bem-sucedida da lista. 0 = nunca. */
  lastUpdatedMs: number;
}

// Cache estático — o hook é chamado em múltiplos componentes (ModelSettingsModal
// e App), mas o fetch só acontece uma vez.
let globalState: State = { models: [], loading: false, error: null, lastUpdatedMs: 0 };
const listeners = new Set<() => void>();

function setState(partial: Partial<State>) {
  Object.assign(globalState, partial);
  for (const l of listeners) l();
}

export function useModelList(): State {
  const [, setTick] = useState(0);
  const requested = useRef(false);

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    // Dispara o fetch uma única vez na montagem do primeiro consumidor.
    if (requested.current || globalState.loading || globalState.models.length > 0 || globalState.error) return;
    requested.current = true;
    setState({ loading: true, error: null });

    void engineSend({ type: "models-list" }).catch((err) => {
      setState({ loading: false, error: (err as Error).message });
    });
  }, []);

  return globalState;
}

/** Alimenta o cache global a partir de um evento models-list-result (chamado pelo useEngine). */
export function handleModelsListResult(ev: Extract<EngineEvent, { type: "models-list-result" }>): void {
  setState({
    models: ev.ok ? ev.models : globalState.models,
    loading: false,
    error: ev.ok ? null : (ev.reason ?? "Falha ao carregar modelos."),
    lastUpdatedMs: ev.ok ? Date.now() : globalState.lastUpdatedMs,
  });
}

/** Força um refresh da lista (botão "Atualizar modelos"). */
export function refreshModelList(): void {
  setState({ loading: true, error: null });
  void engineSend({ type: "models-list" }).catch((err) => {
    setState({ loading: false, error: (err as Error).message });
  });
}

/** Registra o modelo selecionado no `~/.pi/agent/models.json` (engine). */
export function registerModel(model: ListedModel): void {
  void engineSend({
    type: "models-register",
    modelId: model.id,
    name: model.name,
    pricing: model.pricing,
  }).catch(() => undefined);
}
