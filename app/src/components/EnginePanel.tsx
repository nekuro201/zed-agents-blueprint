import type { EngineActions, EngineUiState } from "../hooks/useEngine";
import { TriangleAlert } from "lucide-react";
import { ProjectBar, pickDirectory } from "./ProjectBar";
import { Controls } from "./Controls";
import { PhaseProgress } from "./PhaseProgress";
import { InjectBar } from "./InjectBar";
import { LoopTerminal } from "./v5/LoopTerminal";
import { DocInspectorPane } from "./v5/DocInspectorPane";

/**
 * Painel do engine dentro do view "Loop" do Shell v5.
 * Concentra a UI de operação real (projeto, mock, controles, progresso,
 * injeção e terminal). Recebe estado/ações + projeto/modo por props — o App é a
 * fonte única de `useEngine` e do projeto-alvo (evita estado duplicado).
 */
export function EnginePanel({
  state,
  actions,
  notTauri,
  projectDir,
  mock,
  onProjectDirChange,
  onMockChange,
}: {
  state: EngineUiState;
  actions: EngineActions;
  notTauri: boolean;
  projectDir: string;
  mock: boolean;
  onProjectDirChange: (dir: string) => void;
  onMockChange: (value: boolean) => void;
}) {
  const canStart = projectDir.trim().length > 0 && !state.running;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {notTauri && (
        <div className="flex items-center gap-2 border-b border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          <TriangleAlert size={14} aria-hidden />
          <span>Você está abrindo a UI fora do Tauri (navegador). O motor (Rust + Node) não está
          disponível. Rode via <code className="mx-1 rounded bg-zinc-900 px-1.5 py-0.5 font-mono">pnpm tauri dev</code>.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-b border-edge px-3 py-2.5">
        <div className="min-w-[280px] flex-1">
          <ProjectBar
            value={projectDir}
            onChange={onProjectDirChange}
            onBrowse={async () => {
              const dir = await pickDirectory();
              if (dir) onProjectDirChange(dir);
            }}
          />
        </div>
        <label
          className="flex items-center gap-1.5 text-xs text-zinc-400"
          title="Roda um fluxo pré-gravado sem credenciais (PI_ENGINE_MOCK)"
        >
          <input
            type="checkbox"
            checked={mock}
            onChange={(e) => onMockChange(e.target.checked)}
          />
          Modo simulado
        </label>
        <Controls
          state={state}
          onStart={() => void actions.start(projectDir.trim(), mock)}
          onPause={() => void actions.pause()}
          onResume={() => void actions.resume()}
          onStop={() => void actions.stop()}
          canStart={canStart}
        />
      </div>

      {state.phase && state.phase.total > 0 && (
        <div className="border-b border-edge px-3 py-2">
          <PhaseProgress fase={state.phase.fase} total={state.phase.total} done={state.phase.done} pct={state.phase.pct} />
        </div>
      )}

      <div className="border-b border-edge px-3 py-2">
        <InjectBar enabled={state.running || state.status === "waiting"} onInject={(text) => void actions.inject(text)} />
      </div>

      {state.error && (
        <div className="border-b border-red-900 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-300">
          {state.error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 overflow-hidden">
          <LoopTerminal items={state.timeline} />
        </div>
        <DocInspectorPane projectDir={projectDir} />
      </div>
    </div>
  );
}
