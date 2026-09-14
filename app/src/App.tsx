import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderGit2 } from "lucide-react";
import { useEngine, useEngineSelector, usePlannerCard } from "./hooks/useEngine";
import { useProjectDocs } from "./hooks/useProjectDocs";
import { useActiveView } from "./hooks/useActiveView";
import { Shell } from "./components/v5/Shell";
import { EnginePanel } from "./components/EnginePanel";
import { ChatThreadView } from "./components/v5/ChatThreadView";
import { HistoryModal } from "./components/v5/HistoryModal";
import { ConfirmExitModal } from "./components/v5/ConfirmExitModal";
import { useConversations } from "./hooks/useConversations";
import { newId, type ChatMessage } from "./lib/conversations";
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
import type { AgentModels, AgentThinking, PlanHistoryItem } from "./lib/protocol";
import { createGitBranch, listGitBranches } from "./lib/engine";
import { folderName, parseGitBranches } from "./lib/gitRepo";
import type { ExplorerGroup } from "./components/v5/ExplorerTree";

export default function App() {
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const { actions, notTauri } = useEngine(session?.path ?? "");
  // Assinatura seletiva do store (2.2.4): o App só assina campos de baixa
  // frequência + o card do Planejador — os flushes de streaming (5/seg) não
  // re-renderizam o App nem as views inativas durante um loop.
  const plannerCard = usePlannerCard();
  const planning = useEngineSelector((s) => s.planning);
  const status = useEngineSelector((s) => s.status);
  const connected = useEngineSelector((s) => s.connected);
  const running = useEngineSelector((s) => s.running);
  const tokens = useEngineSelector((s) => s.tokens);
  const cost = useEngineSelector((s) => s.cost);
  const phase = useEngineSelector((s) => s.phase);
  const version = useEngineSelector((s) => s.version);
  const error = useEngineSelector((s) => s.error);
  const errorFase = useEngineSelector((s) => s.errorFase);
  const errorRole = useEngineSelector((s) => s.errorRole);
  const graphStatus = useEngineSelector((s) => s.graphStatus);
  const graphError = useEngineSelector((s) => s.graphError);
  const { view, setView } = useActiveView();
  const [recents, setRecents] = useState<WorkspaceSession[]>(() => loadRecents());
  const [prefs, setPrefs] = useState<EnginePrefs>(() => loadEnginePrefs());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ current: string; names: string[] }>({ current: "", names: [] });
  const [modelConfig, setModelConfig] = useState<AgentModelConfig>(() => loadModelConfig());
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [aborting, setAborting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const mock = prefs.mock;

  const projectDir = session?.path ?? "";
  const { docs, reload } = useProjectDocs(projectDir || null);
  const {
    conversations,
    activeId,
    messages,
    createConversation,
    activate,
    addMessage,
    removeConversation,
  } = useConversations(projectDir);
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  // Persiste o card do Planejador na conversa ativa quando a geração termina.
  const prevPlannerEnded = useRef<boolean | null>(null);
  useEffect(() => {
    const ended = plannerCard?.ended ?? null;
    if (prevPlannerEnded.current === false && ended === true && plannerCard) {
      const msg: ChatMessage = {
        id: newId(),
        role: "planner",
        thinking: plannerCard.thinking,
        text: plannerCard.text.trim() || "PLAN.md gerado/atualizado. Inicie o loop no orquestrador.",
        model: plannerCard.model,
        fallback: plannerCard.fallback,
        costReason: plannerCard.costReason,
        stats: plannerCard.stats,
      };
      addMessage(msg);
    }
    prevPlannerEnded.current = ended;
  }, [plannerCard, addMessage]);

  useEffect(() => {
    // Recarrega os docs do projeto quando o loop avança (fase/status/erro) e
    // após a geração do plano — senão PLAN.md/TODO_BATCH.md/error.log ficam stale.
    if (planning) return;
    reload();
  }, [planning, phase, status, error, reload]);

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
    status === "running" || status === "starting" ? "run" : connected ? "on" : "idle";

  // PLAN.md 100% concluído (todas as fases [x]) → trava o Iniciar Loop e mostra
  // a CTA de voltar ao chat no Loop.
  const planRows = parseDoc(docs.plan ?? "", "plan");
  const planStat = planProgress(planRows);
  const planComplete = planStat.total > 0 && planStat.done === planStat.total;

  // Ao encerrar o loop (qualquer motivo), limpa o estado transitório de aborto.
  useEffect(() => {
    if (!running) setAborting(false);
  }, [running]);

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
  const statusFase = error
    ? [errorFase, errorRole].filter(Boolean).join(" · ") || phase?.fase || session.path
    : (phase?.fase ?? session.path);

  const statusBar = (
    <StatusBar
      motor={motor}
      branch={session.name}
      fase={statusFase}
      tokens={`${formatTokens(tokens.total)} · ${formatCost(cost)}`}
      version={`v${version ?? "0.1.0"}`}
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
      graphStatus={graphStatus}
      graphError={graphError}
      onGenerate={regenerateGraph}
    />
  );

  return (
    <>
      <Shell
        view={view}
        onViewChange={setView}
        workspaceName={session.name}
        onCloseWorkspace={() => {
          // Se há execução em andamento, pede confirmação antes de abortar.
          if (running || planning) {
            setConfirmExitOpen(true);
            return;
          }
          void actions.stop();
          actions.reset();
          setSession(null);
        }}
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
        tokensLabel={formatTokens(tokens.total)}
        workspaceView={
          <EnginePanel
            notTauri={notTauri}
            docs={docs}
            planProgress={planStat.pct}
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
            planning={planning}
            docs={docs}
            plannerCard={plannerCard}
            messages={messages}
            activeLabel={activeConversation?.label ?? ""}
            onProjectDirChange={persist}
            onMockChange={setMockValue}
            onBrowse={async () => {
              const dir = await pickDirectory();
              if (dir) persist(dir);
            }}
            onSend={(prompt) => {
              // Histórico de turnos anteriores (sem o thinking do Planner) para o
              // engine manter o contexto — cada turno não é mais isolado.
              const history: PlanHistoryItem[] = messages
                .map((m) =>
                  m.role === "user"
                    ? { role: "user" as const, text: m.text }
                    : { role: "planner" as const, text: m.text.trim() || m.thinking.trim() },
                )
                .filter((h) => h.text.trim().length > 0);
              addMessage({ id: newId(), role: "user", text: prompt });
              void actions.generatePlan(projectDir, prompt, mock, buildModels(), buildThinking(), history);
            }}
            onOpenHistory={() => setHistoryOpen(true)}
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
              tokens={`${formatTokens(tokens.total)} · ${formatCost(cost)}`}
              version={`v${version ?? "0.1.0"}`}
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
      <HistoryModal
        open={historyOpen}
        conversations={conversations}
        activeId={activeId}
        onActivate={(id) => {
          activate(id);
          setHistoryOpen(false);
        }}
        onNew={() => {
          createConversation();
          setHistoryOpen(false);
        }}
        onDelete={removeConversation}
        onClose={() => setHistoryOpen(false)}
      />
      <ConfirmExitModal
        open={confirmExitOpen}
        onCancel={() => setConfirmExitOpen(false)}
        onConfirm={() => {
          setConfirmExitOpen(false);
          void actions.stop();
          actions.reset();
          setSession(null);
        }}
      />
    </>
  );
}
