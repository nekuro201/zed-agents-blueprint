import { cn } from "../../lib/cn";
import { formatBytes } from "../../lib/format";
import { memoryBreakdown, memoryLevel, memoryTotal, type MemoryLevel } from "../../lib/memory";
import type { ProcessMemory } from "../../lib/engine";
import { useProcessMemory } from "../../hooks/useProcessMemory";

const DOT: Record<MemoryLevel, string> = {
  ok: "bg-zinc-600",
  warn: "bg-amber-400",
  alert: "bg-red-500",
};

const TEXT: Record<MemoryLevel, string> = {
  ok: "text-zinc-500",
  warn: "text-amber-400/80",
  alert: "text-red-400",
};

/**
 * Indicador de memória do rodapé (2.2.5). Mostra o RSS TOTAL dos processos e
 * detalha no tooltip (UI · Motor · App) — evita abrir o htop num loop longo.
 * Apresentacional puro: recebe a medição e decide cor/rótulo.
 */
export function MemoryChipView({ mem }: { mem: ProcessMemory | null }) {
  const total = memoryTotal(mem);
  if (mem === null || total === null) return null;
  const level = memoryLevel(total);
  return (
    <span
      title={memoryBreakdown(mem)}
      className={cn("inline-flex items-center gap-1.5 font-mono", TEXT[level])}
    >
      <span data-memory={level} className={cn("h-1.5 w-1.5 rounded-full", DOT[level])} />
      {formatBytes(total)}
    </span>
  );
}

/**
 * Chip de memória (container): lê o RSS do Rust em polling e delega ao view.
 * O estado do polling vive aqui — só este chip re-renderiza a cada 3s.
 */
export function MemoryChip() {
  return <MemoryChipView mem={useProcessMemory()} />;
}
