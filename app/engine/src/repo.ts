import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";

/**
 * Operações de arquivo escopadas ao projeto alvo.
 * Todas as resoluções de path são relativas a `projectDir` — nunca deixamos
 * um caminho escapar do projeto (proteção contra `../` na UI e em inferências).
 */
export class Repo {
  constructor(readonly projectDir: string) {}

  private resolve(rel: string): string {
    const p = path.resolve(this.projectDir, rel);
    if (!p.startsWith(path.resolve(this.projectDir) + path.sep) && p !== path.resolve(this.projectDir)) {
      throw new Error(`Caminho fora do projeto: ${rel}`);
    }
    return p;
  }

  async exists(rel: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(rel));
      return true;
    } catch {
      return false;
    }
  }

  async read(rel: string): Promise<string | null> {
    try {
      return await fs.readFile(this.resolve(rel), "utf-8");
    } catch {
      return null;
    }
  }

  async write(rel: string, content: string): Promise<void> {
    await fs.writeFile(this.resolve(rel), content, "utf-8");
  }
}

export interface PhaseInfo {
  /** Texto do título da fase, ex.: "Fase 1: Setup". */
  title: string;
  /** Marcador no título: "[x]", "[-]" ou "[ ]". */
  marker: "x" | "-" | " ";
}

const FASE_RE = /^(#{2,3})\s+\[([ x-])\]\s*(.+)$/;

/**
 * Parse determinístico do PLAN.md (marcadores nos títulos de Fases/Sub-fases,
 * conforme as skills planejador/techlead). Zero regex sobre texto de LLM —
 * apenas sobre o markdown estruturado que o próprio fluxo mantém.
 */
export function parsePlan(plan: string): PhaseInfo[] {
  const phases: PhaseInfo[] = [];
  for (const line of plan.split("\n")) {
    const m = FASE_RE.exec(line);
    if (m) {
      phases.push({
        marker: m[2] as PhaseInfo["marker"],
        title: m[3].trim(),
      });
    }
  }
  return phases;
}

/**
 * Primeira fase pendente. `[ ]` (pendente) e `[-]` (em andamento, marcado pelo
 * techlead/testador) são consideradas pendentes. Null se todas concluídas.
 */
export function nextPendingPhase(plan: string): PhaseInfo | null {
  return parsePlan(plan).find((p) => p.marker === " " || p.marker === "-") ?? null;
}

/** Soma de progresso: fases com `[x]` / total de fases. */
export function planProgress(plan: string): { total: number; done: number } {
  const phases = parsePlan(plan);
  const done = phases.filter((p) => p.marker === "x").length;
  return { total: phases.length, done };
}

/**
 * Marca a fase localmente como concluída: troca o marcador `[ ]` ou `[-]` -> `[x]`
 * no primeiro título cujo texto corresponda a `fase`. Se o texto não bater
 * (título levemente diferente), aplica na primeira fase não-concluída encontrada.
 * Determinístico — a edição de estado NÃO é delegada ao LLM.
 */
export function markPhaseDone(plan: string, fase: string): string {
  const lines = plan.split("\n");
  let applied = false;
  const buscarExato = fase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  for (let i = 0; i < lines.length && !applied; i++) {
    const m = FASE_RE.exec(lines[i]);
    if (!m) continue;
    const ehAlvo = new RegExp(`^${buscarExato}\\s*$`).test(m[3].trim());
    if ((m[2] === " " || m[2] === "-") && (fase === "" || ehAlvo)) {
      lines[i] = lines[i].replace(/\[[ -]\]/, "[x]");
      applied = true;
    }
  }

  // Fallback: primeira fase não-concluída ([ ] ou [-]) se nada bateu.
  if (!applied) {
    for (let i = 0; i < lines.length; i++) {
      if (/^#{2,3}\s+\[[ -]\]/.test(lines[i])) {
        lines[i] = lines[i].replace(/\[[ -]\]/, "[x]");
        applied = true;
        break;
      }
    }
  }

  return applied ? lines.join("\n") : plan;
}

export interface GraphStaleness {
  /** True quando existe ao menos um arquivo de código mais novo que o graph.json. */
  stale: boolean;
  /** Quantos arquivos de código mudaram após a geração do grafo. */
  changedCount: number;
}

/**
 * Diretórios que NÃO representam código-fonte e por isso não contam para a
 * staleness do grafo (artefatos de build/controle de versão/dependências).
 */
const GRAPH_SKIP_DIRS = new Set(["graphify-out", ".git", "node_modules", "dist", "target", ".next", ".nuxt"]);

/**
 * Detector de staleness do grafo (E3, Fase 5).
 *
 * O `graphify-out/graph.json` fica DESATUALIZADO quando existe qualquer arquivo
 * do projeto com mtime posterior ao dele (alguém editou código depois da última
 * geração). Sem `graph.json`, retorna `{ stale:false, changedCount:0 }` — ausência
 * de grafo não é o mesmo que grafo desatualizado (o viewer já trata o estado vazio).
 */
export async function computeGraphStaleness(projectDir: string): Promise<GraphStaleness> {
  const graphJson = path.join(projectDir, "graphify-out", "graph.json");
  let graphMtimeMs: number;
  try {
    graphMtimeMs = (await fs.stat(graphJson)).mtimeMs;
  } catch {
    return { stale: false, changedCount: 0 };
  }

  let changedCount = 0;

  const walk = async (dir: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (GRAPH_SKIP_DIRS.has(entry.name)) continue;
        await walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const st = await fs.stat(path.join(dir, entry.name));
        if (st.mtimeMs > graphMtimeMs) changedCount++;
      } catch {
        /* arquivo sumiu durante a varredura — ignora */
      }
    }
  };

  await walk(projectDir);
  return { stale: changedCount > 0, changedCount };
}
