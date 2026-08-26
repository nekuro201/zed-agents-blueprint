/**
 * Persistência das conversas da thread (histórico multi-sessão — E5/UI v7).
 *
 * Cada conversa pertence a um "scope" (chave = projectDir do workspace aberto).
 * O contexto (mensagens) de cada conversa é salvo em localStorage, de modo que
 * trocar de view, de conversa ou reabrir o app preserva o histórico.
 */

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "planner";
      thinking: string;
      text: string;
      model?: string;
      fallback?: boolean;
      costReason?: string;
      stats?: { tokens: { total: number }; cost: number };
    };

export interface Conversation {
  id: string;
  label: string;
  createdAt: number;
  messages: ChatMessage[];
}

/** Map chaveado pelo projectDir (workspace). Cada chave tem a lista de conversas. */
export type ConversationsMap = Record<string, Conversation[]>;

const STORAGE_KEY = "pi-factory:conversations";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadConversations(): ConversationsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ConversationsMap;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveConversations(map: ConversationsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage indisponível/cheio — nunca quebra a app.
  }
}

/** Retorna as conversas de um scope, ou lista vazia se não existir. */
export function conversationsFor(map: ConversationsMap, projectDir: string): Conversation[] {
  return map[projectDir] ?? [];
}

/** Deriva o título da conversa a partir do primeiro prompt (truncado). */
export function deriveConversationLabel(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "Nova conversa";
  return t.length > 40 ? `${t.slice(0, 40).trimEnd()}…` : t;
}
