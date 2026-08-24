import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  onTogglePalette: () => void;
  onClosePalette: () => void;
  /** Recebe o número do atalho ⌘N (1..9); o chamador mapeia via viewByShortcut. */
  onSelectView: (shortcut: number) => void;
  onToggleExplorer?: () => void;
}

/**
 * Atalhos globais (v5 → keydown do protótipo):
 *   ⌘/Ctrl+K  → alterna a command palette
 *   ⌘/Ctrl+1/2/3 → troca de view
 *   Escape     → fecha a palette
 * Os handlers ficam num ref para não re-registrar o listener a cada render.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") {
        e.preventDefault();
        ref.current.onClosePalette();
        return;
      }
      if (!meta) return;

      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current.onTogglePalette();
        return;
      }
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        ref.current.onToggleExplorer?.();
        return;
      }
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        ref.current.onSelectView(Number(e.key));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
