import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";

/**
 * Classificação determinística do "formato" do projeto + helpers de verificação
 * de entregáveis para o caminho rápido de projetos estáticos.
 *
 * Motivação (otimização de robustez): projetos de arquivo único (ex.: HTML/CSS
 * estático, sem `package.json`) não têm infraestrutura de teste e não devem
 * passar pelo pipeline pesado (grafo + QA LLM + testador LLM), nem ter arquivos
 * de teste fabricados para satisfazer a doutrina TDD.
 *
 * Regra (determinística, nunca regex sobre texto de LLM):
 *   - `static`  = sem `package.json` E sem arquivos `.test`/`.spec`.
 *   - `managed` = tudo o mais (projeto com gerenciador/dependências ou com testes).
 */

export type ProjectKind = "static" | "managed";

export interface ProjectProfile {
  kind: ProjectKind;
  hasPackageJson: boolean;
  hasTestRunner: boolean;
  hasTestFiles: boolean;
}

/** Diretórios de artefato que não contam como código-fonte (mesmo critério do grafo). */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  "out",
  ".next",
  ".nuxt",
  "graphify-out",
  "coverage",
  ".cache",
]);

const TEST_FILE_RE = /\.(test|spec)\.(js|mjs|cjs|jsx|ts|tsx)$/;

function hasRunnerScript(scripts: Record<string, string>): boolean {
  for (const [name, cmd] of Object.entries(scripts)) {
    const isTestName = name === "test" || name.startsWith("test:");
    const mentionsRunner = /(vitest|jest|ava|mocha|playwright|cypress|karma|jasmine)/.test(cmd);
    if (isTestName || mentionsRunner) return true;
  }
  return false;
}

async function hasTestFileInTree(dir: string): Promise<boolean> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (await hasTestFileInTree(path.join(dir, entry.name))) return true;
      continue;
    }
    if (!entry.isFile()) continue;
    if (TEST_FILE_RE.test(entry.name)) return true;
  }
  return false;
}

/** Classifica o projeto de forma determinística (nunca lança). */
export async function classifyProject(projectDir: string): Promise<ProjectProfile> {
  let hasPackageJson = false;
  let hasTestRunner = false;

  try {
    const raw = await fs.readFile(path.join(projectDir, "package.json"), "utf-8");
    hasPackageJson = true;
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    hasTestRunner = hasRunnerScript(pkg.scripts ?? {});
  } catch {
    // Sem package.json (ou JSON inválido) — tratado como ausente.
  }

  const hasTestFiles = await hasTestFileInTree(projectDir);
  const kind: ProjectKind = hasPackageJson || hasTestFiles ? "managed" : "static";
  return { kind, hasPackageJson, hasTestRunner, hasTestFiles };
}

/**
 * Tarefas não finalizadas no TODO_BATCH.md: checkbox pendente (`- [ ]`),
 * bloqueada (`- [!]`) ou em andamento (`- [-]`). Para o caminho estático, um
 * batch concluído pelo Coder deve ter apenas `- [x]`.
 */
export function hasUnfinishedTasks(todoBatch: string): boolean {
  return /-\s*\[[ !-]\]/m.test(todoBatch);
}

/** Extensões de arquivo reconhecidas como entregáveis (cobre o caso estático). */
const DELIVERABLE_EXT_RE = /\.(html|css|scss|sass|less|js|mjs|cjs|jsx|ts|tsx|json|md|mdx|svg|png|jpe?g|webp|gif|ico|yml|yaml|toml|txt|sh|py|go|rs|java|rb|php|c|cpp|h|hpp)$/i;

/**
 * Extrai caminhos de arquivo entregáveis de um TODO_BATCH.md (spans de código
 * `` `...` `` cujo conteúdo termina em uma extensão reconhecida). Determinístico
 * e sem duplicatas — usado pela verificação direta de projetos estáticos.
 */
export function extractDeliverableFiles(todoBatch: string): string[] {
  const files = new Set<string>();
  const re = /`([^`\n]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(todoBatch)) !== null) {
    const p = m[1].trim();
    if (!p || p.includes(" ") || p.includes("\n")) continue;
    if (DELIVERABLE_EXT_RE.test(p)) files.add(p);
  }
  return [...files].sort();
}
