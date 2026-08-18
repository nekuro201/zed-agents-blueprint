import { cn } from "../../lib/cn";
import { planProgress, type DocRow } from "../../lib/docs";

/**
 * Inspector de documentos (2.3 — SOMENTE leitura).
 * Recebe as rows já parseadas + título; destaca a linha em andamento (`now`) e,
 * se `showProgress`, exibe a barra de progresso do PLAN.
 */
export function DocInspector({
  title,
  rows,
  showProgress = false,
}: {
  title: string;
  rows: DocRow[];
  showProgress?: boolean;
}) {
  const progress = showProgress ? planProgress(rows) : null;

  return (
    <div className="flex h-full flex-col bg-[#0f1116]">
      <div className="flex items-center justify-between border-b border-edge px-3 py-1.5 text-[11px] font-semibold text-zinc-300">
        <span>{title}</span>
        {progress && progress.total > 0 && (
          <span className="font-mono text-[10px] text-zinc-500">
            {progress.done}/{progress.total} · {progress.pct}%
          </span>
        )}
      </div>

      {progress && progress.total > 0 && (
        <div className="h-1 w-full bg-surface">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress.pct}%` }} />
        </div>
      )}

      <div className="flex-1 overflow-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed">
        {rows.length === 0 ? (
          <div className="text-zinc-600">Aguardando conteúdo do arquivo…</div>
        ) : (
          rows.map((row, i) => (
            <div
              key={i}
              data-cls={row.cls}
              style={{ paddingLeft: `${(row.indent - 1) * 14 + 8}px` }}
              className={cn(
                "flex items-baseline gap-2",
                row.cls === "done" && "text-zinc-600",
                row.cls === "now" && "rounded bg-amber-400/10 text-amber-200",
                row.cls === "todo" && "text-zinc-400",
              )}
            >
              {row.mark && <span className={cn("w-6 shrink-0", row.cls === "now" && "font-bold text-amber-400")}>{row.mark}</span>}
              <span className="truncate">{row.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
