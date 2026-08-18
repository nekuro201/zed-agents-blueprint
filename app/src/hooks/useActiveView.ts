import { useState } from "react";
import type { ViewId } from "../lib/views";

/**
 * Estado da view ativa (v5: Chat Global / Chat da Thread / Loop).
 * Inicia em "chat-thread" (comportamento do protótipo).
 */
export function useActiveView(initial: ViewId = "chat-thread") {
  const [view, setView] = useState<ViewId>(initial);
  return { view, setView };
}

export type UseActiveView = ReturnType<typeof useActiveView>;
