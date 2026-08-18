import { Pause, Play, Square } from "lucide-react";
import { cn } from "../lib/cn";
import type { EngineUiState } from "../hooks/useEngine";

export function Controls({
  state,
  onStart,
  onPause,
  onResume,
  onStop,
  canStart,
}: {
  state: EngineUiState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  canStart: boolean;
}) {
  const running = state.running;
  const waiting = state.status === "waiting";
  const inTauri = state.tauri;

  const base =
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onStart}
        disabled={!canStart || !inTauri}
        className={cn(base, "border-emerald-800 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-800/50")}
        title="Iniciar o ciclo (planejador → techlead → coder)"
      >
        <Play size={14} aria-hidden /> Iniciar
      </button>
      <button
        onClick={onPause}
        disabled={!running || waiting || !inTauri}
        className={cn(base, "border-amber-800 bg-amber-900/40 text-amber-200 hover:bg-amber-800/50")}
        title="Pausar no próximo ponto seguro"
      >
        <Pause size={14} aria-hidden /> Pausar
      </button>
      <button
        onClick={onResume}
        disabled={!waiting || !inTauri}
        className={cn(base, "border-emerald-800 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-800/50")}
        title="Retomar do ponto onde pausou"
      >
        <Play size={14} aria-hidden /> Retomar
      </button>
      <button
        onClick={onStop}
        disabled={!running || !inTauri}
        className={cn(base, "border-red-800 bg-red-900/40 text-red-200 hover:bg-red-800/50")}
        title="Interromper a execução (aborta a sessão do agente)"
      >
        <Square size={13} aria-hidden /> Parar
      </button>
    </div>
  );
}
