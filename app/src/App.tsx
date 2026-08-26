import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderGit2 } from "lucide-react";
import { useEngine } from "./hooks/useEngine";
import { useProjectDocs } from "./hooks/useProjectDocs";
import { useActiveView } from "./hooks/useActiveView";
import type { PlannerCard } from "./components/v5/ChatThreadView";
import { Shell } from "./components/v5/Shell";
import { EnginePanel } from "./components/EnginePanel";
import { ChatThreadView } from "./components/v5/ChatThreadView";
import { GraphViewer } from "./components/v5/GraphViewer";
import { ModelSettingsModal } from "./components/v5/ModelSettingsModal";
import { StatusBar, type MotorState } from "./components/v5/StatusBar";
import { HomeScreen } from "./components/v6/HomeScreen";
import { HomeSettingsModal } from "./components/v6/HomeSettingsModal";
import { formatCost, formatTokens } from "./lib/format";
import { parseDoc, planProgress } from "./lib/docs";
import { pickDirectory } from "./components/ProjectBar";
import { loadRecents, removeRecent, upsertRecent, type WorkspaceSession } from "./lib/workspaceSession";
import { loadEnginePrefs, saveEnginePrefs, type EnginePrefs } from "./lib/enginePrefs";
import { loadModelConfig, saveModelConfig, type AgentModelConfig } from "./lib/modelConfig";
import type { AgentModels, AgentThinking } from "./lib/protocol";
import { createGitBranch, listGitBranches } from "./lib/engine";
import { folderName, parseGitBranches } from "./lib/gitRepo";
import type { ExplorerGroup } from "./components/v5/ExplorerTree";

export default function App() {
  const { state, actions, notTauri } = useEngine();
  const { view, setView } = useActiveView();
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [recents, setRecents] = useState<WorkspaceSession[]>(() => loadRecents());
  const [prefs, setPrefs] = useState<EnginePrefs>(() => loadEnginePrefs());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ current: string; names: string[] }>({ current: "", names: [] });
  const [modelConfig, setModelConfig] = useState<AgentModelConfig>(() => loadModelConfig());
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [aborting, setAborting] = useState(false);
  const mock = prefs.mock;

  /** Card do Planejador (último da timeline) — streaming ou já concluído. */
  const plannerCard: PlannerCard | null = useMemo(() => {
    for (let i = state.timeline.length - 1; i >= 0; i--) {
      const it = state.timeline[i];
      if (it?.kind === "agent" && it.role === "planejador") {
        return { thinking: it.thinking, text: it.text, model: it.model, fallback: it.fallback, costReason: it.costReason, ended: it.ended, stats: it.stats };
      }
    }
    return null;
  }, [state.timeline]);

  const projectDir = session?.path ?? "";
  const { docs, reload } = useProjectDocs(projectDir || null);

  useEffect(() => {
    // Recarrega os docs do projeto quando o loop avança (fase/status/erro) e
    // após a geração do plano — senão PLAN.md/TODO_BATCH.md/error.log ficam stale.
    if (state.planning) return;
    reload();
  }, [state.planning, state.phase, state.status, state.error, reload]);

  const reloadBranches = useCallback(async (dir: string) => {
    try {
      const data = await listGitBranches(dir);
      setBranches({ current: data.current, names: data.branches });
      setGitError(null);
    } catch (err) {
      setBranches({ current: "", names: [] });
      setGitError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (session) void reloadBranches(session.path);
  }, [session, reloadBranches]);

  const persistPrefs = (next: EnginePrefs) => {
    setPrefs(next);
    saveEnginePrefs(next);
  };

  const setMockValue = (value: boolean) => {
    persistPrefs({ ...prefs, mock: value });
  };

  const openWorkspace = (input: { name: string; path: string }) => {
    const next = upsertRecent(input);
    setRecents(loadRecents());
    setSession(next);
    // Workspace recém-aberto sempre começa na Chat da Thread (view é global no App).
    setView("chat-thread");
    // E10 — spawna o engine no boot do workspace para que comandos como
    // `models-list` tenham um processo alvo mesmo antes do loop iniciar.
    void actions.ensureEngine(input.path, mock);
  };

  const forgetRecent = (path: string) => {
    removeRecent(path);
    setRecents(loadRecents());
  };

  const hasGit = branches.names.length > 0 && !gitError;

  const explorerGroups: ExplorerGroup[] = useMemo(() => {
    if (!session) return [];
    const parsed = parseGitBranches(branches.names.join("\n"), branches.current);
    return [
      {
        name: session.name || folderName(session.path),
        icon: FolderGit2,
        branches: parsed.map((b) => ({ name: b.name, status: b.current ? "run" : "ok" })),
      },
    ];
  }, [session, branches]);

  const persist = (dir: string) => {
    if (!dir.trim()) return;
    openWorkspace({ name: dir.replace(/\\/g, "/").split("/").filter(Boolean).pop() || dir, path: dir });
  };

  /**
   * Modelos por papel a partir da config salva (ModelSettingsModal). Mapeia 1:1
   * os 7 papéis do protocolo — sem colapsar Leitor/Testador/Crise em outro papel.
   */
  const buildModels = (): AgentModels => {
    const cfg = loadModelConfig();
    return {
      planejador: cfg.planejador.model,
      leitor: cfg.leitor.model,
      techlead: cfg.techlead.model,
      coder: cfg.coder.model,
      testador: cfg.testador.model,
      qa: cfg.qa.model,
      crise: cfg.crise.model,
    };
  };

  /** Thinking por papel a partir da config salva (E10). */
  const buildThinking = (): AgentThinking => {
    const cfg = loadModelConfig();
    return {
      planejador: cfg.planejador.thinking,
      leitor: cfg.leitor.thinking,
      techlead: cfg.techlead.thinking,
      coder: cfg.coder.thinking,
      testador: cfg.testador.thinking,
      qa: cfg.qa.thinking,
      crise: cfg.crise.thinking,
    };
  };

  const motor: MotorState =
    state.status === "running" || state.status === "starting" ? "run" : state.connected ? "on" : "idle";

  // PLAN.md 100% concluído (todas as fases [x]) → trava o Iniciar Loop e mostra
  // a CTA de voltar ao chat no Loop.
  const planRows = parseDoc(docs.plan ?? "", "plan");
  const planStat = planProgress(planRows);
  const planComplete = planStat.total > 0 && planStat.done === planStat.total;

  // Ao encerrar o loop (qualquer motivo), limpa o estado transitório de aborto.
  useEffect(() => {
    if (!state.running) setAborting(false);
  }, [state.running]);

  if (!session) {
    return (
      <>
        <HomeScreen
          recents={recents}
          mock={mock}
          onOpen={openWorkspace}
          onRemove={forgetRecent}
          onPickFolder={pickDirectory}
          onMockChange={setMockValue}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <HomeSettingsModal
          open={settingsOpen}
          prefs={prefs}
          onSave={persistPrefs}
          onClose={() => setSettingsOpen(false)}
        />
      </>
    );
  }

  /** E4 — quando há erro, mostra o contexto (fase/agente) na statusbar. */
  const statusFase = state.error
    ? [state.errorFase, state.errorRole].filter(Boolean).join(" · ") || state.phase?.fase || session.path
    : (state.phase?.fase ?? session.path);

  const statusBar = (
    <StatusBar
      motor={motor}
      branch={session.name}
      fase={statusFase}
      tokens={`${formatTokens(state.tokens.total)} · ${formatCost(state.cost)}`}
      elapsed={`${state.elapsed}s`}
      version={`v${state.version ?? "0.1.0"}`}
      onToggleExplorer={() => setExplorerOpen((open) => !open)}
      explorerOpen={explorerOpen}
      onOpenSettings={() => setModelSettingsOpen(true)}
    />
  );

  const regenerateGraph = () => {
    if (projectDir) void actions.generateGraph(projectDir, mock);
  };

  const graphView = (
    <GraphViewer
      projectDir={projectDir}
      graphStatus={state.graphStatus}
      graphError={state.graphError}
      onGenerate={regenerateGraph}
    />
  );

  return (
    <>
      <Shell
        view={view}
        onViewChange={setView}
        workspaceName={session.name}
        onCloseWorkspace={() => setSession(null)}
        onAddWorkspace={async () => {
          const dir = await pickDirectory();
          if (dir) persist(dir);
        }}
        onNewThread={async () => {
          const name = window.prompt("Nome da nova thread (branch git)");
          if (!name?.trim() || !session) return;
          try {
            await createGitBranch(session.path, name.trim());
            await reloadBranches(session.path);
            setGitError(null);
          } catch (err) {
            setGitError((err as Error).message);
          }
        }}
        explorerGroups={explorerGroups}
        explorerHasGit={hasGit}
        explorerOpen={explorerOpen}
        onToggleExplorer={() => setExplorerOpen((open) => !open)}
        tokensLabel={formatTokens(state.tokens.total)}
        workspaceView={
          <EnginePanel
            state={state}
            notTauri={notTauri}
            docs={docs}
            planProgress={planStat.pct}
            completed={state.completed}
            hasPlan={Boolean(docs.plan)}
            planComplete={planComplete}
            projectDir={projectDir}
            aborting={aborting}
            actions={actions}
            onStart={() => {
              if (!docs.plan || planComplete) return;
              void actions.start(projectDir.trim(), mock, buildModels(), buildThinking());
            }}
            onStop={() => {
              setAborting(true);
              void actions.stop();
            }}
            onRegenerateGraph={() => {
              void actions.generateGraph(projectDir, mock);
            }}
            onBackToChat={() => setView("chat-thread")}
          />
        }
        threadView={
          <ChatThreadView
            projectDir={projectDir}
            mock={mock}
            planning={state.planning}
            docs={docs}
            plannerCard={plannerCard}
            onProjectDirChange={persist}
            onMockChange={setMockValue}
            onBrowse={async () => {
              const dir = await pickDirectory();
              if (dir) persist(dir);
            }}
            onGenerate={(prompt) => void actions.generatePlan(projectDir, prompt, mock, buildModels(), buildThinking())}
          />
        }
        graphView={graphView}
        onGenerateGraph={regenerateGraph}
        onViewGraph={() => setView("graph")}
        statusBar={
          gitError ? (
            <StatusBar
              motor={motor}
              branch={session.name}
              fase={gitError}
              tokens={`${formatTokens(state.tokens.total)} · ${formatCost(state.cost)}`}
              elapsed={`${state.elapsed}s`}
              version={`v${state.version ?? "0.1.0"}`}
              onToggleExplorer={() => setExplorerOpen((open) => !open)}
              explorerOpen={explorerOpen}
              onOpenSettings={() => setModelSettingsOpen(true)}
            />
          ) : (
            statusBar
          )
        }
      />
      <ModelSettingsModal
        open={modelSettingsOpen}
        config={modelConfig}
        onSave={(next) => {
          saveModelConfig(next);
          setModelConfig(next);
        }}
        onClose={() => setModelSettingsOpen(false)}
      />
    </>
  );
}
