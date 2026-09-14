import { memo, useEffect } from "react";
import { Brain, Clock, CornerDownRight, Eye, FlaskConical, Info, Package, Scale, TriangleAlert, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";
import { useStickToBottom } from "../../hooks/useStickToBottom";
import { formatDuration } from "../../lib/format";
import { ROLE_COLOR, ROLE_LABEL } from "../../lib/roles";
import type { TimelineItem } from "../../hooks/useEngine";

/**
 * Terminal do loop (v5 → `.work/.term`).
 * Consome o MESMO `TimelineItem[]` do reducer (fonte única) e o renderiza no
 * estilo terminal: cards de agente com thinking colapsável (aberto enquanto
 * "live", fechado quando termina), tools, stats, testes/QA/commit/log/status.
 *
 * Performance (2.2.4): janela fixa dos últimos LOOP_TERMINAL_MAX_ITEMS —
 * DOM e memória nunca crescem sem limite em loops longos.
 */
export const LOOP_TERMINAL_MAX_ITEMS = 400;

const COST_REASON_TEXT: Record<string, string> = {
  "no-pricing": "O modelo não reporta preço na API do llmgateway — custo indisponível.",
  "not-found": "Modelo não encontrado na lista do llmgateway — sem preço para calcular o custo.",
  "not-loaded": "Lista de modelos/preços não carregada — custo indisponível.",
};


function AgentBlock({ item }: { item: Extract<TimelineItem, { kind: "agent" }> }) {
  return (
    <div
      className={cn(
        "mt-2 mb-1.5 overflow-hidden rounded-lg border",
        item.ended ? "border-edge bg-[#131418]" : "border-accent/40 bg-[#15161a] shadow-[0_8px_24px_rgba(0,0,0,.18)]",
      )}
    >
      <details open={!item.ended}>
        <summary className="flex cursor-pointer select-none items-center gap-2 px-2.5 py-1.5">
          <span className={cn("text-[10px] font-bold uppercase tracking-wide", ROLE_COLOR[item.role])}>
            {ROLE_LABEL[item.role]}
          </span>
          {item.model && <span className="truncate text-[10px] text-zinc-600">{item.model}</span>}
          {item.fallback && (
            <span
              title="Modelo configurado não encontrado; usando o fallback padrão"
              className="inline-flex items-center gap-1 rounded bg-amber-950/50 px-1.5 py-px text-[9px] font-semibold text-amber-400"
            >
              <CornerDownRight size={10} aria-hidden /> fallback
            </span>
          )}
          {item.attempt !== undefined && (
            <span className="rounded bg-black/40 px-1 py-px text-[10px] text-zinc-500">
              tentativa {item.attempt}/{item.maxAttempts ?? "?"}
            </span>
          )}
          <span className="flex-1" />
          {!item.ended && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              live
            </span>
          )}
        </summary>

        <div className="border-t border-edge/60 px-2.5 py-1.5">
          {item.capped && (
            <div className="mb-1.5 flex items-center gap-1.5 rounded bg-zinc-900/60 px-2 py-1 text-[10px] text-zinc-500">
              <TriangleAlert size={10} className="shrink-0 text-amber-500/70" aria-hidden />
              Conteúdo truncado por limite de memória (mostrando o final).
            </div>
          )}
          {item.thinking.trim() && (
            <div className="mb-1.5 flex gap-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-amber-200/70">
              <Brain size={12} className="mt-0.5 shrink-0 text-amber-500/70" aria-hidden />
              <span>
                {item.thinking}
                {!item.ended && <span className="ml-0.5 inline-block animate-pulse text-amber-400">▊</span>}
              </span>
            </div>
          )}
          {item.text.trim() && (
            <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-200">{item.text}</div>
          )}
          {item.tools.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {item.tools.map((tool, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-emerald-500">$</span>
                  <span className="font-semibold text-zinc-300">{tool.tool}</span>
                  <span className="truncate text-zinc-600">{tool.args}</span>
                  {tool.ok !== undefined && (
                    <span className={cn("ml-auto", tool.ok ? "text-emerald-500" : "text-red-500")}>
                      {tool.ok ? "✓" : "✕"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {item.ended && (item.stats || item.durationMs !== undefined) && (
            <div className="mt-1 flex flex-wrap gap-3 border-t border-edge/40 pt-1 text-[10px] text-zinc-600">
              {item.stats && <span>Σ {item.stats.tokens.total} tokens</span>}
              {item.stats && <span className="text-amber-400/70">US$ {item.stats.cost.toFixed(4)}</span>}
              {item.costReason && item.costReason !== "pricing" && item.costReason !== "sdk" && (
                <span
                  title={COST_REASON_TEXT[item.costReason] ?? "Custo indisponível"}
                  className="inline-flex items-center gap-1 rounded bg-amber-950/50 px-1.5 py-px text-[9px] font-semibold text-amber-400"
                >
                  <TriangleAlert size={10} aria-hidden /> custo indisponível
                </span>
              )}
              {item.durationMs !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={10} aria-hidden /> {formatDuration(item.durationMs)}
                </span>
              )}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function TestBlock({ item }: { item: Extract<TimelineItem, { kind: "test" }> }) {
  const label =
    item.state === "ok" ? "Testes OK" : item.state === "fail" ? "Testes falharam" : "Rodando testes…";
  const color = item.state === "ok" ? "text-emerald-400" : item.state === "fail" ? "text-red-400" : "text-zinc-400";
  return (
    <div className="mt-1.5 rounded-lg border border-edge bg-[#131418]">
      <div className={cn("flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold", color)}>
        <FlaskConical size={12} aria-hidden /> {label}
        {item.state === "start" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      </div>
      {item.output.trim() && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap border-t border-edge/40 px-2.5 py-1.5 text-[11px] leading-relaxed text-zinc-500">
          {item.output}
        </pre>
      )}
    </div>
  );
}

/** E4 — Card de crise no terminal com ações de auditoria. */
function CrisisCard({
  item,
  crisisActive,
  onCrisisAccept,
  onCrisisRevert,
  onFocusInspector,
}: {
  item: Extract<TimelineItem, { kind: "crisis" }>;
  crisisActive: boolean;
  onCrisisAccept?: () => void;
  onCrisisRevert?: () => void;
  onFocusInspector?: () => void;
}) {
  return (
    <div className="mt-2 rounded-lg border border-amber-700/60 bg-amber-950/20">
      <div className="flex items-start gap-2 border-b border-amber-700/30 px-3 py-2">
        <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold text-amber-300">Protocolo de Crise</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-amber-200/70">{item.message}</div>
        </div>
      </div>
      {item.diff && (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap border-b border-amber-700/20 px-3 py-1.5 text-[10px] leading-relaxed text-amber-400/60">
          {item.diff}
        </pre>
      )}
      {crisisActive && (
        <div className="flex items-center gap-2 px-3 py-2">
          {onFocusInspector && (
            <button
              type="button"
              onClick={onFocusInspector}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-700/50 bg-amber-950/40 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition-colors hover:border-amber-500 hover:bg-amber-900/40"
            >
              <Eye size={11} aria-hidden /> Inspecionar TODO_BATCH
            </button>
          )}
          <span className="flex-1" />
          {onCrisisRevert && (
            <button
              type="button"
              onClick={onCrisisRevert}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-700/50 bg-red-950/30 px-2.5 py-1 text-[11px] font-medium text-red-300 transition-colors hover:border-red-500 hover:bg-red-900/40"
            >
              <XCircle size={11} aria-hidden /> Reverter e parar
            </button>
          )}
          {onCrisisAccept && (
            <button
              type="button"
              onClick={onCrisisAccept}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700/50 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:border-emerald-500 hover:bg-emerald-900/40"
            >
              <Package size={11} aria-hidden /> Aceitar e continuar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface CrisisActions {
  crisisActive?: boolean;
  onCrisisAccept?: () => void;
  onCrisisRevert?: () => void;
  onFocusInspector?: () => void;
}

/**
 * Linha do terminal memoizada (2.2.4): a comparação por referência do `item`
 * faz com que um evento de streaming re-renderize SÓ o card afetado — os demais
 * (até 400) pulam o re-render — em vez de refazer todo o DOM a cada token.
 */
const TerminalLine = memo(function TerminalLine({ item, crisisActive = false, onCrisisAccept, onCrisisRevert, onFocusInspector }: { item: TimelineItem } & CrisisActions) {
  switch (item.kind) {
    case "phase":
      return (
        <div className="mt-2 flex items-center gap-2 text-[12px] font-bold text-zinc-100">
          <span className="text-amber-400">🏁</span>
          {item.fase}
        </div>
      );
    case "agent":
      return <AgentBlock item={item} />;
    case "test":
      return <TestBlock item={item} />;
    case "qa":
      return (
        <div className="mt-1 flex items-start gap-2 text-[11px]">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
              item.veredito === "ESPERADO" ? "bg-violet-900/40 text-violet-300" : "bg-red-900/40 text-red-300",
            )}
          >
            <Scale size={10} aria-hidden /> {item.veredito}
          </span>
          <span className="text-zinc-500">{item.justificativa}</span>
        </div>
      );
    case "commit":
      return (
        <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Package size={11} aria-hidden />
          <span>{item.ok ? "" : "(falha) "}{item.message}</span>
        </div>
      );
    case "crisis":
      return <CrisisCard item={item} crisisActive={crisisActive} onCrisisAccept={onCrisisAccept} onCrisisRevert={onCrisisRevert} onFocusInspector={onFocusInspector} />;
    case "retry":
      return (
        <div className="inline-flex items-start gap-1.5 text-[11px] text-amber-400">
          <TriangleAlert size={11} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Retry {item.role} (tentativa {item.attempt}/{item.maxAttempts}) — {item.reason} — aguardando {item.delayMs}ms
          </span>
        </div>
      );
    case "injected":
      return (
        <div className="inline-flex items-start gap-1.5 text-[11px] text-sky-400">
          <CornerDownRight size={11} className="mt-0.5 shrink-0" aria-hidden />
          <span>{item.text}</span>
        </div>
      );
    case "log":
      return (
        <div className="inline-flex items-start gap-1.5 text-[11px] text-zinc-500">
          {item.level === "warn" ? (
            <TriangleAlert size={11} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
          ) : item.level === "error" ? (
            <XCircle size={11} className="mt-0.5 shrink-0 text-red-400" aria-hidden />
          ) : (
            <Info size={11} className="mt-0.5 shrink-0" aria-hidden />
          )}
          <span>{item.message}</span>
        </div>
      );
    case "status":
      return (
        <div className={cn("text-[11px]", item.status === "stopping" ? "italic text-amber-400" : item.status === "error" ? "text-red-400" : "text-zinc-400")}>
          {item.stage && (
            <span className="mr-1.5 rounded border border-amber-500/30 bg-amber-400/10 px-1 py-px text-[10px] font-semibold text-amber-300">
              {item.stage}
            </span>
          )}
          {item.message}
          {item.sub && <span className="text-zinc-600"> · {item.sub}</span>}
        </div>
      );
    default:
      return null;
  }
});

interface LoopTerminalProps {
  items: TimelineItem[];
  /** Se o loop está em crise aguardando decisão (status === "waiting" && stage === "crisis"). */
  crisisActive?: boolean;
  onCrisisAccept?: () => void;
  onCrisisRevert?: () => void;
  onFocusInspector?: () => void;
}

export function LoopTerminal({ items, crisisActive = false, onCrisisAccept, onCrisisRevert, onFocusInspector }: LoopTerminalProps) {
  const windowed = items.slice(-LOOP_TERMINAL_MAX_ITEMS);
  const { ref, stickToBottom } = useStickToBottom<HTMLDivElement>();

  // Acompanha o streaming: a timeline muda a cada novo item E a cada card de agente
  // sendo "patcheado" (token/thinking). Se o usuário está perto do fim, rola junto.
  useEffect(() => {
    stickToBottom();
  }, [items, stickToBottom]);

  if (windowed.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 font-sans text-sm text-zinc-600">
        Inicie o loop para o Techlead fatiar a fase ativa e o Coder executar o batch.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-testid="loop-terminal"
      className="h-full overflow-y-auto bg-[#0d0e12] px-4 py-3 font-mono text-[12.5px] leading-relaxed text-zinc-300"
    >
      {windowed.map((item) => (
        <TerminalLine key={item.id} item={item} crisisActive={crisisActive} onCrisisAccept={onCrisisAccept} onCrisisRevert={onCrisisRevert} onFocusInspector={onFocusInspector} />
      ))}
    </div>
  );
}
