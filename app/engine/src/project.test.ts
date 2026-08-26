import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { classifyProject, extractDeliverableFiles, hasUnfinishedTasks } from "./project";

/**
 * Classificador determinístico de "formato do projeto" + helpers de verificação
 * de entregáveis (caminho rápido para projetos estáticos sem infra de teste).
 *
 * Motivação: projetos de arquivo único (HTML/CSS estático, sem package.json) não
 * devem passar pelo pipeline pesado (grafo + QA LLM + testador LLM) nem ter
 * arquivos de teste fabricados para satisfazer a doutrina TDD.
 */

async function makeProjectDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "project-test-"));
}

async function write(dir: string, rel: string, content = "x\n"): Promise<void> {
  const p = path.join(dir, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content);
}

describe("classifyProject (formato do projeto)", () => {
  it("diretório vazio → static (sem package.json e sem arquivos de teste)", async () => {
    const dir = await makeProjectDir();
    try {
      await expect(classifyProject(dir)).resolves.toEqual({
        kind: "static",
        hasPackageJson: false,
        hasTestRunner: false,
        hasTestFiles: false,
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("projeto estático (index.html + style.css) → static", async () => {
    const dir = await makeProjectDir();
    try {
      await write(dir, "index.html", "<h1>Hello</h1>\n");
      await write(dir, "style.css", "body { color: red }\n");
      const profile = await classifyProject(dir);
      expect(profile).toEqual({
        kind: "static",
        hasPackageJson: false,
        hasTestRunner: false,
        hasTestFiles: false,
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("package.json sem script de teste → managed (mas sem test runner)", async () => {
    const dir = await makeProjectDir();
    try {
      await write(dir, "package.json", JSON.stringify({ name: "x", scripts: { dev: "vite" } }));
      await expect(classifyProject(dir)).resolves.toEqual({
        kind: "managed",
        hasPackageJson: true,
        hasTestRunner: false,
        hasTestFiles: false,
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("package.json com script `test` → managed + test runner", async () => {
    const dir = await makeProjectDir();
    try {
      await write(dir, "package.json", JSON.stringify({ scripts: { test: "vitest run" } }));
      await expect(classifyProject(dir)).resolves.toEqual({
        kind: "managed",
        hasPackageJson: true,
        hasTestRunner: true,
        hasTestFiles: false,
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("package.json com runner `vitest` fora do nome `test` → test runner", async () => {
    const dir = await makeProjectDir();
    try {
      await write(dir, "package.json", JSON.stringify({ scripts: { check: "vitest run --coverage" } }));
      const profile = await classifyProject(dir);
      expect(profile.hasTestRunner).toBe(true);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("apenas arquivo .test.ts (sem package.json) → managed com test files", async () => {
    const dir = await makeProjectDir();
    try {
      await write(dir, "src/a.test.ts", "it('x', () => {});\n");
      await expect(classifyProject(dir)).resolves.toEqual({
        kind: "managed",
        hasPackageJson: false,
        hasTestRunner: false,
        hasTestFiles: true,
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("ignora arquivos de teste dentro de diretórios de artefato", async () => {
    const dir = await makeProjectDir();
    try {
      await write(dir, "node_modules/x/a.test.js");
      await write(dir, ".git/a.spec.ts");
      await write(dir, "dist/a.test.js");
      await expect(classifyProject(dir)).resolves.toEqual({
        kind: "static",
        hasPackageJson: false,
        hasTestRunner: false,
        hasTestFiles: false,
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("hasUnfinishedTasks (TODO_BATCH.md)", () => {
  it("detecta checkbox pendente (- [ ])", () => {
    expect(hasUnfinishedTasks("- [ ] T1 — criar index.html\n")).toBe(true);
  });

  it("detecta tarefa bloqueada (- [!])", () => {
    expect(hasUnfinishedTasks("- [!] T2 — sem motivo\n")).toBe(true);
  });

  it("detecta tarefa em andamento (- [-])", () => {
    expect(hasUnfinishedTasks("- [-] T3 — em progresso\n")).toBe(true);
  });

  it("não acusa batch 100% concluído (- [x])", () => {
    expect(hasUnfinishedTasks("- [x] T1 — criar index.html\n- [x] T2 — criar style.css\n")).toBe(false);
  });
});

describe("extractDeliverableFiles (TODO_BATCH.md)", () => {
  it("extrai caminhos de arquivo de células de tabela (formato techlead)", () => {
    const batch = [
      "# TODO BATCH",
      "| Campo | Valor |",
      "|-------|-------|",
      "| **Arquivo** | `index.html` |",
      "| **Arquivo** | `style.css` |",
      "",
    ].join("\n");
    expect(extractDeliverableFiles(batch)).toEqual(["index.html", "style.css"]);
  });

  it("extrai caminhos em bullets e ignora spans não-arquivo", () => {
    const batch = [
      "- [ ] T1 `[⚡ Flash]` — Criar `index.html`",
      "- [ ] T2 `[⚡ Flash]` — Criar `style.css`",
    ].join("\n");
    expect(extractDeliverableFiles(batch)).toEqual(["index.html", "style.css"]);
  });

  it("não repete arquivos duplicados", () => {
    const batch = "`index.html` e também `index.html`";
    expect(extractDeliverableFiles(batch)).toEqual(["index.html"]);
  });

  it("retorna lista vazia quando não há spans de arquivo", () => {
    expect(extractDeliverableFiles("Tarefa sem caminho de arquivo.\n")).toEqual([]);
  });
});
