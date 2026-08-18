import type { EngineStatus } from "../lib/protocol";

const MAP: Record<string, { label: string; cls: string; dot: string }> = {
  offline: { label: "Offline", cls: "bg-zinc-800 text-zinc-400 border-zinc-700", dot: "bg-zinc-500" },
  idle: { label: "Pronto", cls: "bg-zinc-800 text-zinc-300 border-zinc-700", dot: "bg-zinc-400" },
  starting: { label: "Iniciando", cls: "bg-sky-950 text-sky-300 border-sky-800", dot: "bg-sky-400 animate-pulse" },
  running: { label: "Executando", cls: "bg-emerald-950 text-emerald-300 border-emerald-800", dot: "bg-emerald-400 animate-pulse" },
  waiting: { label: "Aguardando", cls: "bg-amber-950 text-amber-300 border-amber-800", dot: "bg-amber-400 animate-pulse" },
  done: { label: "Concluído", cls: "bg-emerald-950 text-emerald-300 border-emerald-800", dot: "bg-emerald-400" },
  error: { label: "Erro", cls: "bg-red-950 text-red-300 border-red-800", dot: "bg-red-400" },
  stopping: { label: "Parando", cls: "bg-zinc-800 text-zinc-300 border-zinc-700", dot: "bg-zinc-400" },
};

export function StatusBadge({ status, mock }: { status: EngineStatus | "idle" | "offline"; mock: boolean }) {
  const m = MAP[status] ?? MAP.offline;
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
        {m.label}
      </span>
      {mock && (
        <span className="rounded-full border border-fuchsia-800 bg-fuchsia-950 px-2.5 py-0.5 text-xs font-medium text-fuchsia-300">
          Modo simulado
        </span>
      )}
    </div>
  );
}
