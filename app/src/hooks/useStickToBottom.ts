import { useCallback, useEffect, useRef } from "react";

/**
 * Auto-scroll "grudado no fim": acompanha o conteúdo novo apenas quando o usuário
 * está perto do fim do container (dentro de `threshold` px). Se ele rolou para
 * cima além do threshold, o scroll não é forçado.
 *
 * Uso:
 *   const { ref, stickToBottom } = useStickToBottom<HTMLDivElement>();
 *   useEffect(() => { stickToBottom(); }, [conteudoQueCresce]);
 *   <div ref={ref} className="overflow-auto">…</div>
 */
export function useStickToBottom<T extends HTMLElement>(threshold = 120) {
  const ref = useRef<T | null>(null);
  const stick = useRef(true);

  const stickToBottom = useCallback(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return { ref, stickToBottom };
}
