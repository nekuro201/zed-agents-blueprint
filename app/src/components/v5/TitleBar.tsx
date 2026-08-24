import { ArrowLeft, Coins } from "lucide-react";

/**
 * Titlebar (v5 → `.titlebar`): marca, ⌘K, tokens global e usuário.
 * Contém o botão que abre a command palette.
 */
export function TitleBar({
  onOpenPalette,
  tokensLabel = "0",
  user = "Abe",
  subtitle = "/ app",
  onBackToProjects,
}: {
  onOpenPalette: () => void;
  tokensLabel?: string;
  user?: string;
  subtitle?: string;
  onBackToProjects?: () => void;
}) {
  return (
    <header className="flex select-none items-center gap-3 border-b border-edge bg-panel px-3.5 py-2">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-100">
        <span className="grid h-5 w-5 place-items-center rounded bg-linear-to-br from-amber-300 to-amber-500 text-[9px] font-bold text-zinc-950">
          π
        </span>
        Pi Factory <span className="font-medium text-zinc-500">{subtitle}</span>
      </div>
      <div className="flex-1" />
      {onBackToProjects && (
        <button
          type="button"
          onClick={onBackToProjects}
          className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface px-2 py-1 text-[11px] text-zinc-400 hover:border-accent/60 hover:text-zinc-200"
        >
          <ArrowLeft size={12} aria-hidden /> Projetos
        </button>
      )}
      <button
        type="button"
        onClick={onOpenPalette}
        title="Command palette"
        className="rounded-md border border-edge bg-surface px-2 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:border-accent/60 hover:text-zinc-200"
      >
        ⌘K
      </button>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] text-amber-300">
        <Coins size={12} aria-hidden />
        <span data-testid="global-tokens">{tokensLabel}</span>
      </span>
      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
        <span className="grid h-5 w-5 place-items-center rounded-full border border-edge bg-surface text-[9px] text-accent">
          A
        </span>
        {user}
      </span>
    </header>
  );
}
