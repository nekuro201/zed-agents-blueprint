import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  ExternalLink,
  GitCompareArrows,
  Network,
  RefreshCw,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { readGraphFile, graphStaleness } from "../../lib/engine";
import { cn } from "../../lib/cn";

export type GraphStatus = "empty" | "loading" | "ready" | "stale";

const BADGE: Record<GraphStatus, { label: string; cls: string }> = {
  empty: { label: "SEM GRAFO", cls: "border-edge bg-panel text-zinc-400" },
  loading: { label: "GERANDO", cls: "border-amber-700/50 bg-amber-950/40 text-amber-300" },
  ready: { label: "ATUALIZADO", cls: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300" },
  stale: { label: "DESATUALIZADO", cls: "border-orange-800/60 bg-orange-950/40 text-orange-300" },
};

/**
 * Viewer do grafo de conhecimento (E3, Fase 4).
 *
 * Exibe o `graph.html` do projeto-alvo dentro de um iframe `srcdoc` — a webview
 * do Tauri bloqueia `file://`, então o conteúdo chega pelo comando `read_graph_file`
 * (somente leitura, mesma guarda anti `../` do inspector). Não desenhamos o grafo
 * à mão: o iframe é a estratégia de exibição.
 *
 * Estados espelham o protótipo `pi_graph2.html`: vazio → gerando → pronto →
 * desatualizado (detecção real via `graph_staleness` + simulação manual pelo
 * botão "Simular alterações").
 */
export function GraphViewer({
  projectDir,
  graphStatus,
  graphError,
  onGenerate,
}: {
  projectDir: string;
  /** Estado vindo do engine (eventos graph-start/ready/error). */
  graphStatus: "empty" | "loading" | "ready";
  graphError?: string | null;
  onGenerate: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [simulatedStale, setSimulatedStale] = useState(false);
  const [realStale, setRealStale] = useState(false);
  const [changedCount, setChangedCount] = useState(0);

  const load = useCallback(async () => {
    const content = await readGraphFile(projectDir, "graphify-out/graph.html");
    setHtml(content);
  }, [projectDir]);

  useEffect(() => {
    void load();
  }, [load, graphStatus]);

  // Detecção real de staleness (Fase 5): re-consulta ao montar e sempre que o
  // grafo é (re)gerado (graphStatus → "ready").
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const result = await graphStaleness(projectDir);
      if (disposed) return;
      setRealStale(result.stale);
      setChangedCount(result.changedCount);
    })();
    return () => {
      disposed = true;
    };
  }, [projectDir, graphStatus]);

  // Regeneração concluída → grafo fresco (limpa o estado simulado de staleness).
  useEffect(() => {
    if (graphStatus === "ready") setSimulatedStale(false);
  }, [graphStatus]);

  const stale = simulatedStale || realStale;

  const status: GraphStatus =
    graphStatus === "loading" ? "loading" : html == null ? "empty" : stale ? "stale" : "ready";

  const ready = status === "ready" || status === "stale";
  const loading = status === "loading";
  const badge = BADGE[status];
  const stalenessMessage = realStale
    ? `Grafo desatualizado — ${changedCount} ${changedCount === 1 ? "arquivo mudou" : "arquivos mudaram"}.`
    : "Grafo desatualizado — arquivos mudaram.";

  const openExternal = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-edge bg-panel/40 px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Network size={14} aria-hidden /> Grafo de Arquitetura
          </h3>
          <p className="truncate text-[11px] text-zinc-500">
            Visual do Graphify embutido. Busca, nós e comunidades ficam no iframe.
          </p>
        </div>
        <span
          data-testid="graph-badge"
          className={cn("ml-auto shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold", badge.cls)}
        >
          {badge.label}
        </span>
      </div>

      {status === "stale" && (
        <div
          data-testid="stale-banner"
          className="flex items-center gap-2 border-b border-orange-900/50 bg-orange-950/30 px-4 py-2 text-xs text-orange-300"
        >
          <TriangleAlert size={14} aria-hidden />
          <span>{stalenessMessage}</span>
          <button
            type="button"
            onClick={onGenerate}
            className="ml-auto rounded-md border border-orange-700 bg-orange-900/40 px-2.5 py-1 font-medium text-orange-200 transition-colors hover:bg-orange-800/50"
          >
            Atualizar grafo
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-edge bg-[#161616] px-4 py-1.5">
        <span className="truncate font-mono text-[10px] text-zinc-500">graphify-out/graph.html</span>
        <span className="rounded border border-edge px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">iframe</span>
        <div className="flex-1" />
        <ToolbarButton icon={Eye} label="Ver grafo" disabled={!ready} onClick={() => void load()} />
        <ToolbarButton icon={RefreshCw} label="Atualizar" disabled={!ready} onClick={onGenerate} />
        <ToolbarButton icon={GitCompareArrows} label="Simular alterações" disabled={!ready} onClick={() => setSimulatedStale(true)} />
        <ToolbarButton icon={ExternalLink} label="Nova aba" disabled={!ready} onClick={openExternal} />
        <ToolbarButton icon={RotateCw} label="Gerar" disabled={loading} primary onClick={onGenerate} />
      </div>

      <div className="relative min-h-0 flex-1">
        {status === "empty" && (
          <div data-testid="graph-empty" className="grid h-full place-items-center p-6">
            <div className="max-w-sm text-center">
              <div className="mb-3 flex justify-center text-zinc-600" aria-hidden>
                <Network size={32} />
              </div>
              <div className="mb-1 text-sm font-medium text-zinc-200">Nenhum grafo gerado ainda</div>
              <p className="mb-4 text-xs text-zinc-500">
                Rode <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono">graphify update &lt;caminho&gt;</code> no projeto.
                O visual entra neste iframe — o app controla gerar, atualizar e o estado.
              </p>
              <button
                type="button"
                onClick={onGenerate}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
              >
                <RotateCw size={12} aria-hidden /> Gerar grafo
              </button>
              {graphError && <p className="mt-3 text-[11px] text-red-400">{graphError}</p>}
            </div>
          </div>
        )}

        {loading && (
          <div data-testid="graph-loading" className="grid h-full place-items-center p-6">
            <div className="text-center">
              <div className="mb-2 text-xs text-zinc-400">gerando grafo…</div>
              <div className="mx-auto h-1 w-40 overflow-hidden rounded bg-zinc-800">
                <div className="h-full w-1/3 animate-pulse rounded bg-accent" />
              </div>
            </div>
          </div>
        )}

        {ready && (
          <iframe
            data-testid="graph-iframe"
            title="Graphify"
            srcDoc={html ?? undefined}
            className="h-full w-full border-0 bg-white"
          />
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  disabled,
  primary = false,
  onClick,
}: {
  icon: typeof Eye;
  label: string;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        primary
          ? "border-accent bg-accent/10 text-accent hover:bg-accent/20"
          : "border-edge bg-panel text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
        disabled && "cursor-not-allowed opacity-40 hover:border-edge hover:text-zinc-400",
      )}
    >
      <Icon size={12} aria-hidden /> {label}
    </button>
  );
}
