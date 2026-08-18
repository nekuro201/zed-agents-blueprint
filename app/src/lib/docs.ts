/**
 * Parser de documentos do projeto-alvo para o inspector (2.3 — SOMENTE leitura).
 * Atua sobre markdown determinístico (headings/checkboxes com marcadores
 * `[x]`/`[-]`/`[ ]`), mantendo o check "zero regex sobre texto de LLM" — aqui é
 * só formatação de arquivos locais.
 */
export type DocKind = "plan" | "todo" | "log" | "agents" | "epics" | "escopo";

export interface DocRow {
  mark: string | null;
  text: string;
  cls: "done" | "now" | "todo";
  indent: number;
}

const HEADING_RE = /^(#{1,6})\s+\[([ x-])\]\s*(.*)$/;
const CHECK_RE = /^\s*[-*]\s+\[([ x-])\]\s*(.*)$/;
const BULLET_RE = /^\s*[-*]\s+(.+)$/;

function row(char: string, text: string, indent: number): DocRow {
  return {
    mark: `[${char}]`,
    text: text.trim(),
    cls: char === "x" ? "done" : char === "-" ? "now" : "todo",
    indent,
  };
}

export function parseDoc(content: string, kind: DocKind): DocRow[] {
  const rows: DocRow[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (trimmed === "") continue;

    if (kind === "log") {
      rows.push({ mark: null, text: trimmed, cls: "todo", indent: 1 });
      continue;
    }

    const leading = line.length - line.trimStart().length;

    if (kind === "plan") {
      const m = HEADING_RE.exec(line);
      if (m) rows.push(row(m[2]!, m[3] ?? "", m[1].length));
      continue;
    }
    if (kind === "todo") {
      const m = CHECK_RE.exec(line);
      if (m) rows.push(row(m[1]!, m[2] ?? "", Math.floor(leading / 4) + 1));
      continue;
    }

    // epics/escopo/agents: mistura de headings/checkboxes marcados + bullets simples.
    const mh = HEADING_RE.exec(line);
    if (mh) {
      rows.push(row(mh[2]!, mh[3] ?? "", mh[1].length));
      continue;
    }
    const mc = CHECK_RE.exec(line);
    if (mc) {
      rows.push(row(mc[1]!, mc[2] ?? "", Math.floor(leading / 4) + 1));
      continue;
    }
    const b = BULLET_RE.exec(line);
    if (b) {
      rows.push({ mark: null, text: b[1]!.trim(), cls: "todo", indent: Math.floor(leading / 4) + 1 });
      continue;
    }
    rows.push({ mark: null, text: trimmed, cls: "todo", indent: Math.floor(leading / 4) + 1 });
  }
  return rows;
}

/** Progresso a partir das rows marcadas (barra do PLAN, 2.3.2). */
export function planProgress(rows: DocRow[]): { total: number; done: number; pct: number } {
  const marked = rows.filter((r) => r.mark !== null);
  const total = marked.length;
  const done = marked.filter((r) => r.cls === "done").length;
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}
