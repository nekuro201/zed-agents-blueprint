import { useEffect, useState } from "react";
import { isTauri, processMemory, type ProcessMemory } from "../lib/engine";

const POLL_MS = 3000;

/**
 * RSS dos processos do app via polling (2.2.5 — indicador do rodapé).
 *
 * Fora do Tauri não faz nada (o indicador simplesmente não aparece). O estado
 * vive só neste hook: apenas o componente que o usa re-renderiza a cada poll —
 * a árvore do App permanece intacta durante o loop.
 */
export function useProcessMemory(enabled = true): ProcessMemory | null {
  const [mem, setMem] = useState<ProcessMemory | null>(null);

  useEffect(() => {
    if (!enabled || !isTauri()) {
      setMem(null);
      return;
    }
    let disposed = false;
    const poll = async () => {
      const next = await processMemory();
      if (!disposed) setMem(next);
    };
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      disposed = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return mem;
}
