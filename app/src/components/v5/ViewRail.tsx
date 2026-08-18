import { cn } from "../../lib/cn";
import { VIEWS, type ViewId } from "../../lib/views";

/**
 * Barra vertical de navegação entre views (v5 → `.rail`).
 * Componente apresentacional: recebe a view ativa e um callback de seleção.
 */
export function ViewRail({
  active,
  onSelect,
}: {
  active: ViewId;
  onSelect: (view: ViewId) => void;
}) {
  return (
    <nav
      aria-label="Views"
      className="flex flex-col items-center gap-1 rounded-lg border border-edge bg-panel p-1.5"
    >
      {VIEWS.map((view) => {
        const isActive = active === view.id;
        return (
          <button
            key={view.id}
            type="button"
            title={view.title}
            aria-label={view.title}
            aria-pressed={isActive}
            data-active={isActive ? "true" : "false"}
            onClick={() => onSelect(view.id)}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-md text-base text-zinc-500 transition-colors",
              "hover:bg-surface hover:text-zinc-200",
              isActive &&
                "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgba(245,158,11,0.35)]",
            )}
          >
            <view.icon size={18} strokeWidth={1.75} aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}
