import type { ViewMeta } from "./views";

/**
 * Modelo de comando da command palette (⌘K).
 * `run` carrega a ação concreta (ex.: trocar de view), composto pelo shell.
 */
export interface PaletteCommand {
  id: string;
  label: string;
  keys?: string;
  run: () => void;
}

/** Constrói um comando de troca de view a partir da config única (DRY). */
export function viewCommand(view: ViewMeta, run: () => void): PaletteCommand {
  return {
    id: `view:${view.id}`,
    label: view.title,
    keys: view.shortcut != null ? `⌘${view.shortcut}` : undefined,
    run,
  };
}
