import { useEffect, useState } from "react";
import {
  loadConversations,
  saveConversations,
  conversationsFor,
  newId,
  deriveConversationLabel,
  type ChatMessage,
  type Conversation,
} from "../lib/conversations";

/**
 * Hook que gerencia as conversas da thread (histórico multi-sessão).
 *
 * O estado vive fora do componente de view, então trocar de janela NÃO limpa a
 * conversa (o Shell desmonta/remonta a view, mas o hook persiste no App).
 */
export function useConversations(projectDir: string) {
  const [map, setMap] = useState(() => loadConversations());
  const [activeId, setActiveId] = useState<string | null>(null);

  const conversations = conversationsFor(map, projectDir);

  // Reset a conversa ativa ao trocar de workspace.
  useEffect(() => {
    setActiveId(null);
  }, [projectDir]);

  // Garante uma conversa inicial quando o workspace abre sem nenhuma.
  useEffect(() => {
    if (conversations.length === 0) {
      const conv: Conversation = { id: newId(), label: "Nova conversa", createdAt: Date.now(), messages: [] };
      setMap((prev) => ({ ...prev, [projectDir]: [conv] }));
    }
  }, [conversations.length, projectDir]);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null;

  // Se ainda não há uma ativa, ativa a primeira.
  useEffect(() => {
    if (!activeId && conversations[0]) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations]);

  // Persiste em localStorage a cada mudança.
  useEffect(() => {
    saveConversations(map);
  }, [map]);

  function createConversation(): void {
    const conv: Conversation = { id: newId(), label: "Nova conversa", createdAt: Date.now(), messages: [] };
    setMap((prev) => ({ ...prev, [projectDir]: [conv, ...(prev[projectDir] ?? [])] }));
    setActiveId(conv.id);
  }

  function activate(id: string): void {
    setActiveId(id);
  }

  function addMessage(msg: ChatMessage): void {
    setMap((prev) => {
      const list = prev[projectDir] ?? [];
      const targetId = activeId ?? list[0]?.id;
      if (!targetId) return prev;
      const idx = list.findIndex((c) => c.id === targetId);
      if (idx < 0) return prev;
      const copy = [...list];
      const cur = copy[idx];
      // Título vem do primeiro prompt de usuário; sem prompt, mantém o fallback.
      const deriveLabel = msg.role === "user" && (cur.label === "Nova conversa" || cur.label === "");
      const label = deriveLabel ? deriveConversationLabel(msg.text) : cur.label;
      copy[idx] = { ...cur, label, messages: [...cur.messages, msg] };
      return { ...prev, [projectDir]: copy };
    });
  }

  function removeConversation(id: string): void {
    setMap((prev) => {
      const list = prev[projectDir] ?? [];
      const filtered = list.filter((c) => c.id !== id);
      return filtered.length === list.length ? prev : { ...prev, [projectDir]: filtered };
    });
    setActiveId((cur) => (cur === id ? null : cur));
  }

  return {
    conversations,
    activeId: active?.id ?? null,
    messages: active?.messages ?? [],
    createConversation,
    activate,
    addMessage,
    removeConversation,
  };
}
