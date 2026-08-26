import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, CornerDownRight, FileCheck2, FolderOpen, MessageSquare, TriangleAlert } from "lucide-react";
import { ProjectBar } from "../ProjectBar";
import { ChatThreadPrompt } from "./ChatThreadPrompt";
import { ThreadInspector } from "./ThreadInspector";
import { cn } from "../../lib/cn";
import { useStickToBottom } from "../../hooks/useStickToBottom";
import { parseDoc, planProgress, type DocRow } from "../../lib/docs";
import type { ProjectDocs } from "../../hooks/useProjectDocs";

type ThreadMsg =
  | { id: number; role: "user"; text: string }
  | {
      id: number;
      role: "planner";
      thinking: string;
      text: string;
      model?: string;
      fallback?: boolean;
      costReason?: "pricing" | "sdk" | "no-pricing" | "not-found" | "not-loaded";
      stats?: { tokens: { total: number }; cost: number };
    };

/** Card do Planejador (vem do reducer/timeline) — streaming ou já concluído. */
export interface PlannerCard {
  thinking: string;
  text: string;
  model?: string;
  fallback?: boolean;
  costReason?: "pricing" | "sdk" | "no-pricing" | "not-found" | "not-loaded";
  ended: boolean;
  stats?: { tokens: { total: number }; cost: number };
}

const SUMMARY_FALLBACK = "PLAN.md gerado/atualizado. Inicie o loop no orquestrador.";

const COST_REASON_TEXT: Record<string, string> = {
  "no-pricing": "O modelo não reporta preço na API do llmgateway — custo indisponível.",
  "not-found": "Modelo não encontrado na lista do llmgateway — sem preço para calcular o custo.",
  "not-loaded": "Lista de modelos/preços não carregada — custo indisponível.",
};

function shortModel(model?: string): string {
  if (!model) return "";
  const slash = model.lastIndexOf("/");
  return slash >= 0 ? model.slice(slash + 1) : model;
}

/**
 * Card do Planejador na conversa (estilo v5). Thinking é colapsável: aberto em
 * streaming, minimizado (details fechado) após terminar — igual ao Loop.
 * Quando congelado, mostra o preview do PLAN.md (`.plan-card` do v5).
 */
function PlannerCardView({
  card,
  live,
  planRows = [],
}: {
  card: Omit<PlannerCard, "ended">;
  live: boolean;
  planRows?: DocRow[];
}) {
  const prog = planRows.length > 0 ? planProgress(planRows) : null;
  return (
    <div
      className={cn(
        "w-fit max-w-[86%] rounded-xl border px-3.5 py-2.5",
        live ? "border-amber-500/30 bg-panel" : "border-edge bg-panel",
      )}
    >
      <div className="mb-2 flex items-center gap-1.5 border-b border-edge pb-2 text-[11px] font-semibold text-amber-300">
        <Brain size={12} aria-hidden /> Planejador
        {card.model && <span className="font-mono text-[10px] font-normal text-zinc-500">{shortModel(card.model)}</span>}
        {card.fallback && (
          <span
            title="Modelo configurado não encontrado; usando o fallback padrão"
            className="inline-flex items-center gap-1 rounded bg-amber-950/50 px-1.5 py-px text-[9px] font-semibold text-amber-400"
          >
            <CornerDownRight size={10} aria-hidden /> fallback
          </span>
        )}
        {live && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            gerando
          </span>
        )}
      </div>

      {card.thinking.trim() && (
        <details open={live} className="mb-1.5">
          <summary className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300">
            <Brain size={11} aria-hidden /> Raciocínio (thinking)
          </summary>
          <div className="mt-1.5 flex gap-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-amber-200/70">
            <span className="pl-4">
              {card.thinking}
              {live && <span className="ml-0.5 inline-block animate-pulse text-amber-400">▊</span>}
            </span>
          </div>
        </details>
      )}

      {card.text.trim() ? (
        <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-200">{card.text}</div>
      ) : (
        !live && <div className="text-[12.5px] leading-relaxed text-zinc-400">{SUMMARY_FALLBACK}</div>
      )}

      {!live && planRows.length > 0 && (
        <div className="mt-2 rounded-lg border border-edge bg-surface/50 px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <FileCheck2 size={12} aria-hidden /> PLAN.md gerado
            {prog && prog.total > 0 && (
              <span className="ml-auto font-mono text-[10px] font-normal text-zinc-500">
                {prog.done}/{prog.total}
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-px">
            {planRows.map((row, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-baseline gap-1.5 text-[11px] leading-relaxed",
                  row.cls === "done" ? "text-zinc-600" : row.cls === "now" ? "text-amber-200" : "text-zinc-400",
                )}
                style={{ paddingLeft: `${(row.indent - 1) * 12 + 2}px` }}
              >
                {row.mark && <span className="w-5 shrink-0 font-mono">{row.mark}</span>}
                <span className="truncate">{row.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!live && card.stats && (
        <div className="mt-1.5 flex flex-wrap items-center gap-3 border-t border-edge/40 pt-1.5 text-[10px] text-zinc-600">
          <span>Σ {card.stats.tokens.total} tokens</span>
          <span className="text-amber-400/70">US$ {card.stats.cost.toFixed(4)}</span>
          {card.costReason && card.costReason !== "pricing" && card.costReason !== "sdk" && (
            <span
              title={COST_REASON_TEXT[card.costReason] ?? "Custo indisponível"}
              className="inline-flex items-center gap-1 rounded bg-amber-950/50 px-1.5 py-px text-[9px] font-semibold text-amber-400"
            >
              <TriangleAlert size={10} aria-hidden /> custo indisponível
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * View "Chat da Thread" — gate de projeto (F1) + bubbles de sessão (F2).
 * O card do Planejador (`plannerCard`) fica persistente na conversa após terminar,
 * com o thinking minimizado e a mensagem final visível. Histórico persistido na Fase C.
 */
export function ChatThreadView({
  projectDir,
  mock,
  planning = false,
  docs = {},
  plannerCard = null,
  onProjectDirChange,
  onMockChange,
  onBrowse,
  onGenerate,
}: {
  projectDir: string;
  mock: boolean;
  planning?: boolean;
  docs?: ProjectDocs;
  /** Card do Planejador (último da timeline) — live ou concluído. */
  plannerCard?: PlannerCard | null;
  onProjectDirChange: (dir: string) => void;
  onMockChange: (value: boolean) => void;
  onBrowse: () => Promise<void> | void;
  onGenerate: (prompt: string) => void;
}) {
  const hasProject = projectDir.trim().length > 0;
  const [messages, setMessages] = useState<ThreadMsg[]>([]);
  const nextId = useRef(1);
  const prevCardEnded = useRef<boolean | null>(null);
  const { ref, stickToBottom } = useStickToBottom<HTMLDivElement>();

  // Acompanha o conteúdo novo (nova mensagem ou thinking streaming do Planejador)
  // apenas quando o usuário está perto do fim.
  useEffect(() => {
    stickToBottom();
  }, [messages, plannerCard?.thinking, plannerCard?.text, stickToBottom]);

  // Quando o card do Planejador termina (agent-end → ended), congela o card na
  // conversa: fica visível depois, com thinking minimizado e a mensagem final.
  // (No modo simulado não há card — o PLAN aparece no inspector à direita.)
  useEffect(() => {
    const ended = plannerCard?.ended ?? null;
    if (prevCardEnded.current === false && ended === true && plannerCard) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: "planner",
          thinking: plannerCard.thinking,
          text: plannerCard.text.trim() || SUMMARY_FALLBACK,
          model: plannerCard.model,
          fallback: plannerCard.fallback,
          costReason: plannerCard.costReason,
          stats: plannerCard.stats,
        },
      ]);
    }
    prevCardEnded.current = ended;
  }, [plannerCard]);

  const handleGenerate = (prompt: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role: "user", text: prompt }]);
    onGenerate(prompt);
  };

  const showLiveCard = Boolean(plannerCard && !plannerCard.ended);
  const streaming = planning || showLiveCard;
  const planRows = useMemo(() => parseDoc(docs.plan ?? "", "plan"), [docs.plan]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-edge bg-panel/40 px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <MessageSquare size={14} aria-hidden /> Assistente da Thread
        </h3>
        <p className="text-[11px] text-zinc-500">
          Descreva o escopo. O Planejador gera o PLAN.md para o loop Techlead ↔ Coder.
        </p>
        {hasProject && (
          <p className="mt-1 truncate font-mono text-[10px] text-zinc-600">{projectDir}</p>
        )}
      </div>

      {hasProject ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-h-0 min-w-0 flex-col">
            <div ref={ref} className="flex min-h-0 flex-1 flex-col overflow-auto px-[8%] py-5">
              {messages.length === 0 && !streaming ? (
                <div className="grid flex-1 place-items-center text-center text-sm text-zinc-600">
                  Escreva o que precisa ser construído — o cadastro/escopo vira um PLAN.md na pasta do projeto.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((msg) =>
                    msg.role === "user" ? (
                      <div key={msg.id} data-role="user" className="max-w-[86%] w-fit self-end">
                        <div className="rounded-xl border border-amber-500/30 bg-amber-400/10 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-100">
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      <div key={msg.id} data-role="planner" className="max-w-[86%] w-fit">
                        <PlannerCardView card={msg} live={false} planRows={planRows} />
                      </div>
                    ),
                  )}
                  {showLiveCard && plannerCard && (
                    <div data-testid="planner-live" className="max-w-[86%] w-fit">
                      <PlannerCardView card={plannerCard} live planRows={planRows} />
                    </div>
                  )}
                  {planning && !plannerCard && (
                    <div className="w-fit max-w-[86%] rounded-xl border border-edge bg-panel px-3.5 py-2.5 text-sm text-zinc-400">
                      <span className="inline-flex items-center gap-1.5 text-amber-300">
                        <Brain size={12} aria-hidden /> Planejador gerando PLAN.md…
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <ChatThreadPrompt onGenerate={handleGenerate} disabled={planning} />
          </div>
          <ThreadInspector docs={docs} />
        </div>
      ) : (
        <div className="grid flex-1 place-items-center px-8">
          <div className="flex w-full max-w-xl flex-col gap-4">
            <p className="text-center text-sm text-zinc-500">
              Selecione a pasta do projeto para liberar o Planejador.
            </p>
            <ProjectBar value={projectDir} onChange={onProjectDirChange} onBrowse={onBrowse} />
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <input type="checkbox" checked={mock} onChange={(e) => onMockChange(e.target.checked)} />
              Modo simulado
            </label>
            <button
              type="button"
              onClick={() => void onBrowse()}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-linear-to-b from-amber-300 to-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950"
            >
              <FolderOpen size={14} aria-hidden /> Abrir projeto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
