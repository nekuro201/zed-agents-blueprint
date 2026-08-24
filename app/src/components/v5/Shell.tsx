import { useMemo, useState, type ReactNode } from "react";
import { Brain, ClipboardList, Code2, Scale } from "lucide-react";
import { useActiveView } from "../../hooks/useActiveView";
import { useShortcuts } from "../../hooks/useShortcuts";
import { VIEWS, viewByShortcut, type ViewId } from "../../lib/views";
import { viewCommand, type PaletteCommand } from "../../lib/commands";
import { TitleBar } from "./TitleBar";
import { ViewRail } from "./ViewRail";
import { StatusBar } from "./StatusBar";
import { ExplorerTree, type ExplorerGroup } from "./ExplorerTree";
import { CommandPalette } from "./CommandPalette";
import { Pipeline, type PipelineAgent } from "./Pipeline";

const PIPELINE: PipelineAgent[] = [
  { id: "plan", label: "Planejador", icon: Brain, model: "deepseek-v4-flash", status: "done" },
  { id: "techlead", label: "Techlead", icon: ClipboardList, model: "deepseek-v4-flash", status: "active" },
  { id: "coder", label: "Coder", icon: Code2, model: "deepseek-v4-flash", status: "idle" },
  { id: "qa", label: "Juiz TDD", icon: Scale, model: "deepseek-v4-flash", status: "idle" },
];

/** Conteúdo de cada view. Na 2.1.1 são placeholders — conteúdo real em 2.2/2.3. */
function ViewPlaceholder({ view }: { view: ViewId }) {
  if (view === "workspace") {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-edge bg-surface/40">
          <Pipeline agents={PIPELINE} />
        </div>
        <div className="grid flex-1 place-items-center p-6 text-sm text-zinc-600">
          <span>Loop do orquestrador — terminal e inspector chegam nas próximas fases (2.2/2.3).</span>
        </div>
      </div>
    );
  }
  const message =
    view === "chat-thread"
      ? "Assistente da thread — histórico real na Fase C (2.1.1 placeholder)."
      : "Pergunte sobre o escopo geral do projeto.";
  const Icon = VIEWS.find((v) => v.id === view)!.icon;
  return (
    <div className="flex flex-1 flex-col">
      <div className="grid flex-1 place-items-center p-6 text-center text-sm text-zinc-600">
        <div>
          <div className="mb-2 flex justify-center" aria-hidden>
            <Icon size={24} />
          </div>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Shell v7: compõe TitleBar + Rail + main (view ativa) + Explorer + StatusBar +
 * CommandPalette. A Sidebar sai; o Orquestrador e o ModelSettingsModal vivem no
 * App (fonte única de hasPlan/planComplete/onStartLoop e do modelConfig).
 * O explorer é controlado por fora (App) — o toggle vive no StatusBar.
 */
export function Shell({
  view: viewProp,
  onViewChange,
  workspaceView,
  threadView,
  statusBar,
  tokensLabel = "0",
  workspaceName,
  onCloseWorkspace,
  onAddWorkspace,
  onNewThread,
  explorerGroups = [],
  explorerHasGit = true,
  explorerOpen = true,
  onToggleExplorer,
}: {
  /** View controlada por fora (App). Se ausente, o Shell controla internamente. */
  view?: ViewId;
  onViewChange?: (v: ViewId) => void;
  workspaceView?: ReactNode;
  threadView?: ReactNode;
  statusBar?: ReactNode;
  tokensLabel?: string;
  workspaceName?: string;
  onCloseWorkspace?: () => void;
  onAddWorkspace?: () => void;
  onNewThread?: () => void;
  explorerGroups?: ExplorerGroup[];
  explorerHasGit?: boolean;
  explorerOpen?: boolean;
  onToggleExplorer?: () => void;
}) {
  const internal = useActiveView();
  const view = viewProp ?? internal.view;
  const setView = onViewChange ?? internal.setView;
  const [paletteOpen, setPaletteOpen] = useState(false);

  const commands: PaletteCommand[] = useMemo(() => VIEWS.map((v) => viewCommand(v, () => setView(v.id))), [setView]);

  useShortcuts({
    onTogglePalette: () => setPaletteOpen((open) => !open),
    onClosePalette: () => setPaletteOpen(false),
    onSelectView: (n) => {
      const id = viewByShortcut(n);
      if (id) setView(id);
    },
    onToggleExplorer,
  });

  return (
    <div className="flex h-full flex-col bg-surface text-zinc-200">
      <TitleBar
        onOpenPalette={() => setPaletteOpen(true)}
        tokensLabel={tokensLabel}
        subtitle={workspaceName ? `/ ${workspaceName}` : "/ app"}
        onBackToProjects={onCloseWorkspace}
      />
      <div className="flex min-h-0 flex-1">
        <ViewRail active={view} onSelect={setView} />
        <main className="flex min-w-0 flex-1 flex-col" data-view={view}>
          {view === "workspace" && workspaceView
            ? workspaceView
            : view === "chat-thread" && threadView
              ? threadView
              : <ViewPlaceholder view={view} />}
        </main>
        <ExplorerTree
          groups={explorerGroups}
          visible={explorerOpen}
          onCloseWorkspace={onCloseWorkspace}
          onAddWorkspace={onAddWorkspace}
          onNewThread={onNewThread}
          hasGit={explorerHasGit}
        />
      </div>
      {statusBar ?? (
        <StatusBar motor="idle" branch="feature/auth-ui" fase="Fase 2.2 · Validação Zod" tokens="8.4k" version="v0.1.0" />
      )}
      <CommandPalette open={paletteOpen} commands={commands} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
