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
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-edge bg-[#161616] py-2"
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
              "relative grid h-8.5 w-8.5 place-items-center rounded-md text-base text-zinc-500 transition-colors",
              "hover:bg-[#2a2a2a] hover:text-zinc-200",
              isActive && "bg-[rgba(212,175,55,0.12)] text-accent",
            )}
          >
            {isActive && (
              <span className="absolute top-2 bottom-2 -left-1.75 w-0.5 rounded-sm bg-accent shadow-[0_0_8px_rgba(212,175,55,0.28)]" aria-hidden />
            )}
            <view.icon size={18} strokeWidth={1.75} aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}
