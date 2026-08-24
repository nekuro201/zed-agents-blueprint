import { useEffect } from "react";
import { Brain, CornerDownRight, FlaskConical, Info, Package, Scale, TriangleAlert, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";
import { useStickToBottom } from "../../hooks/useStickToBottom";
import type { AgentRole } from "../../lib/protocol";
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

const ROLE_LABEL: Record<AgentRole, string> = {
  planejador: "Planejador",
  leitor: "Leitor",
  techlead: "Techlead",
  coder: "Coder",
  testador: "Testador",
  qa: "Juiz TDD",
  crise: "Crise",
};

const ROLE_COLOR: Record<AgentRole, string> = {
  planejador: "text-indigo-400",
  leitor: "text-violet-400",
  techlead: "text-sky-400",
  coder: "text-emerald-400",
  testador: "text-cyan-400",
  qa: "text-fuchsia-400",
  crise: "text-red-400",
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
          {item.ended && item.stats && (
            <div className="mt-1 flex gap-3 border-t border-edge/40 pt-1 text-[10px] text-zinc-600">
              <span>Σ {item.stats.tokens.total} tokens</span>
              <span className="text-amber-400/70">US$ {item.stats.cost.toFixed(4)}</span>
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

function TerminalLine({ item }: { item: TimelineItem }) {
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
      return (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-red-700/50 bg-red-950/30 px-2.5 py-1.5 text-[11px] text-red-300">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden />
          <span>{item.message}</span>
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
        <div className="text-[11px] text-zinc-400">
          {item.message}
          {item.sub && <span className="text-zinc-600"> · {item.sub}</span>}
        </div>
      );
    default:
      return null;
  }
}

export function LoopTerminal({ items }: { items: TimelineItem[] }) {
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
        <TerminalLine key={item.id} item={item} />
      ))}
    </div>
  );
}
