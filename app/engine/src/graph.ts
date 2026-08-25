import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { EngineEvent } from "./protocol.js";

/**
 * Runner da geração do grafo de conhecimento via Graphify.
 *
 * Degradação graciosa é requisito de aceite do E3: sem `graphify` instalado o app
 * roda exatamente como hoje — `runGraphify` **nunca lança**, apenas retorna um
 * `GraphResult` com `ok:false` + um `reason` acionável.
 */

export interface GraphResult {
  ok: boolean;
  reason?: "not-installed" | "timeout" | "empty";
  /** Caminho absoluto do resumo em markdown gerado pelo graphify. */
  reportPath?: string;
  /** Caminho absoluto do grafo cru (graph.json). */
  jsonPath?: string;
}

/** Diretório de saída do binário `graphify update <dir>` dentro do projectDir. */
const GRAPHIFY_OUT_DIR = "graphify-out";
const GRAPH_TIMEOUT_MS = 120_000;

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "ENOENT";
}

/**
 * Roda `graphify update <projectDir>` e verifica os artefatos produzidos em
 * `graphify-out/` (graph.json + GRAPH_REPORT.md). Nunca lança.
 *
 * Usa o subcomando `update` (AST determinístico, sem chave LLM) em vez do pipeline
 * completo `graphify .`, que dispara extração semântica e exige API key quando o
 * corpus tem docs/papers/imagens — o que faria a geração falhar num repositório
 * misto sem credenciais. `update` gera graph.json + graph.html + GRAPH_REPORT.md
 * em uma única passada.
 */
export function runGraphify(projectDir: string): Promise<GraphResult> {
  const reportPath = path.join(projectDir, GRAPHIFY_OUT_DIR, "GRAPH_REPORT.md");
  const jsonPath = path.join(projectDir, GRAPHIFY_OUT_DIR, "graph.json");

  return new Promise<GraphResult>((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("graphify", ["update", projectDir], { cwd: projectDir });
    } catch (err) {
      resolve({ ok: false, reason: isEnoent(err) ? "not-installed" : "empty" });
      return;
    }

    let settled = false;
    const settle = (result: GraphResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    // Drena stdout/stderr para o buffer nunca crescer sem limite.
    child.stdout?.on("data", () => {});
    child.stderr?.on("data", () => {});

    const timer = setTimeout(() => {
      child.kill();
      settle({ ok: false, reason: "timeout" });
    }, GRAPH_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      settle({ ok: false, reason: isEnoent(err) ? "not-installed" : "empty" });
    });

    child.on("close", async () => {
      clearTimeout(timer);
      try {
        const [hasReport, hasJson] = await Promise.all([exists(reportPath), exists(jsonPath)]);
        settle(hasReport && hasJson ? { ok: true, reportPath, jsonPath } : { ok: false, reason: "empty" });
      } catch {
        settle({ ok: false, reason: "empty" });
      }
    });
  });
}

/**
 * Helper compartilhado (DRY) usado pelos gatilhos (open do workspace + fim de
 * fase) e pelo handler do comando `graph`: emite `graph-start`, roda o runner e
 * emite `graph-ready`/`graph-error`. Degradação graciosa — nunca lança.
 */
export async function generateGraphFor(emit: (e: EngineEvent) => void, projectDir: string): Promise<void> {
  emit({ type: "graph-start", projectDir });
  try {
    const result = await runGraphify(projectDir);
    if (result.ok) {
      emit({ type: "graph-ready", projectDir, reportPath: result.reportPath });
    } else {
      emit({ type: "graph-error", message: `Falha ao gerar o grafo: ${result.reason ?? "erro desconhecido"}.` });
    }
  } catch (err) {
    emit({ type: "graph-error", message: `Falha ao gerar o grafo: ${(err as Error).message}` });
  }
}
