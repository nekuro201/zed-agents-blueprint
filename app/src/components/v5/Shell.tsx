import { useMemo, useState, type ReactNode } from "react";
import { Atom, Brain, ClipboardList, Code2, Scale, Server } from "lucide-react";
import { useActiveView } from "../../hooks/useActiveView";
import { useShortcuts } from "../../hooks/useShortcuts";
import { VIEWS, viewByShortcut, type ViewId } from "../../lib/views";
import { viewCommand, type PaletteCommand } from "../../lib/commands";
import { TitleBar } from "./TitleBar";
import { ViewRail } from "./ViewRail";
import { Sidebar, type SidebarAgent } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { ExplorerTree, type ExplorerGroup } from "./ExplorerTree";
import { CommandPalette } from "./CommandPalette";
import { Pipeline, type PipelineAgent } from "./Pipeline";

/**
 * Dados placeholder do shell (Fase C não implementa explorer/roster persistidos;
 * valores reais vêm do engine nas próximas fases — ver PLAN 2.2/2.3).
 */
const PLACEHOLDER_AGENTS: SidebarAgent[] = [
  { id: "plan", label: "Planejador", icon: Brain, model: "deepseek-v4-flash", thinking: "Standard" },
  { id: "techlead", label: "Techlead", icon: ClipboardList, model: "deepseek-v4-flash", thinking: "Standard" },
  { id: "coder", label: "Coder", icon: Code2, model: "deepseek-v4-flash", thinking: "Standard" },
  { id: "qa", label: "Juiz TDD", icon: Scale, model: "grok-4-5", thinking: "Maximum" },
];

const PLACEHOLDER_GROUPS: ExplorerGroup[] = [
  {
    name: "Frontend E-commerce",
    icon: Atom,
    branches: [
      { name: "main", status: "ok" },
      { name: "feature/auth-ui", status: "run" },
      { name: "fix/cart-calc", status: "new" },
      { name: "refactor/api", status: "err" },
    ],
  },
  { name: "Backend API Hub", icon: Server, branches: [{ name: "main", status: "ok" }] },
];

const PIPELINE: PipelineAgent[] = [
  { id: "plan", label: "Planejador", icon: Brain, model: "deepseek-v4-flash", status: "done" },
  { id: "techlead", label: "Techlead", icon: ClipboardList, model: "deepseek-v4-flash", status: "active" },
  { id: "coder", label: "Coder", icon: Code2, model: "deepseek-v4-flash", status: "idle" },
  { id: "qa", label: "Juiz TDD", icon: Scale, model: "grok-4-5", status: "idle" },
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
 * Shell v5: compõe TitleBar + Rail + Sidebar + main (view ativa) + Explorer +
 * StatusBar + CommandPalette, orquestrando navegação, palette e atalhos.
 */
export function Shell({
  workspaceView,
  threadView,
  statusBar,
}: {
  workspaceView?: ReactNode;
  threadView?: ReactNode;
  statusBar?: ReactNode;
}) {
  const { view, setView } = useActiveView();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const commands: PaletteCommand[] = useMemo(() => VIEWS.map((v) => viewCommand(v, () => setView(v.id))), [setView]);

  useShortcuts({
    onTogglePalette: () => setPaletteOpen((open) => !open),
    onClosePalette: () => setPaletteOpen(false),
    onSelectView: (n) => {
      const id = viewByShortcut(n);
      if (id) setView(id);
    },
  });

  return (
    <div className="flex h-full flex-col bg-surface text-zinc-200">
      <TitleBar onOpenPalette={() => setPaletteOpen(true)} tokensLabel="8.4k" />
      <div className="flex min-h-0 flex-1">
        <ViewRail active={view} onSelect={setView} />
        <Sidebar
          agents={PLACEHOLDER_AGENTS}
          running={false}
          onStart={() => {
            /* e2.2 — iniciar o loop do engine */
          }}
          onAbort={() => {
            /* e2.2 */
          }}
          activeLabel="feature/auth-ui"
        />
        <main className="flex min-w-0 flex-1 flex-col" data-view={view}>
          {view === "workspace" && workspaceView
            ? workspaceView
            : view === "chat-thread" && threadView
              ? threadView
              : <ViewPlaceholder view={view} />}
        </main>
        <ExplorerTree groups={PLACEHOLDER_GROUPS} />
      </div>
      {statusBar ?? (
        <StatusBar motor="idle" branch="feature/auth-ui" fase="Fase 2.2 · Validação Zod" tokens="8.4k" version="v0.1.0" />
      )}
      <CommandPalette open={paletteOpen} commands={commands} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
