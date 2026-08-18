import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import type { PaletteCommand } from "../../lib/commands";

/**
 * Command palette (⌘K) — protótipo v5 → `.palette`.
 * Componente controlado: renderiza somente quando `open`, filtra `commands`
 * pelo texto digitado, mantém o item destacado e notifica ao escolher/escapar.
 */
export function CommandPalette({
  open,
  commands,
  onClose,
}: {
  open: boolean;
  commands: PaletteCommand[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase())),
    [commands, query],
  );

  // Ao abrir, reinicia o estado (evita que fique "sujo" da última vez).
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
    }
  }, [open]);

  const pick = (command: PaletteCommand | undefined) => {
    if (!command) return;
    command.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        pick(filtered[highlight]);
        break;
    }
  };

  if (!open) return null;

  return (
    <div
      data-testid="palette-overlay"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[calc(100vw-32px)] max-w-[35rem] overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Buscar comando…"
          aria-label="Buscar comando"
          className="h-12 w-full border-b border-edge bg-transparent px-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        <div className="p-2" role="listbox" aria-label="Comandos">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-500">Nenhum comando</div>
          ) : (
            filtered.map((command, i) => (
              <button
                key={command.id}
                type="button"
                role="option"
                aria-selected={i === highlight}
                data-highlight={i === highlight ? "true" : "false"}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(command)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-300",
                  i === highlight && "bg-accent/10 text-zinc-100",
                )}
              >
                <span aria-hidden>
                  <ChevronRight size={14} />
                </span>
                <span className="truncate">{command.label}</span>
                {command.keys && (
                  <kbd className="ml-auto font-mono text-[10px] text-zinc-500">{command.keys}</kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
