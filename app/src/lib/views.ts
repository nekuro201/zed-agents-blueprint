import type { LucideIcon } from "lucide-react";
import { Globe, MessageSquare, Network, Zap } from "lucide-react";

/**
 * Configuração única das views do app (DRY — fonte única para Rail, atalhos e
 * quaisquer outras partes que precisarem listar as views).
 */
export type ViewId = "chat-global" | "chat-thread" | "graph" | "workspace";

export interface ViewMeta {
  id: ViewId;
  title: string;
  icon: LucideIcon;
  description: string;
  /** Número do atalho ⌘N (opcional — views como Grafo usam atalhos próprios ⌘G/⌘V). */
  shortcut?: number;
}

export const VIEWS: ViewMeta[] = [
  { id: "chat-global", title: "Chat Global", icon: Globe, description: "Contexto cruzado entre threads", shortcut: 1 },
  { id: "chat-thread", title: "Chat da Thread", icon: MessageSquare, description: "Assistente da thread ativa", shortcut: 2 },
  { id: "graph", title: "Grafo", icon: Network, description: "Visual do grafo de conhecimento (Graphify)" },
  { id: "workspace", title: "Loop", icon: Zap, description: "Orquestrador visual do loop", shortcut: 3 },
];

/** Resolve a view pelo atalho numérico ⌘N (usa a config única — DRY). */
export function viewByShortcut(n: number): ViewId | undefined {
  return VIEWS.find((v) => v.shortcut === n)?.id;
}
