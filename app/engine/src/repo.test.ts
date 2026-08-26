import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { computeGraphStaleness, Repo, unifiedDiff } from "./repo";

/**
 * Fase 5 — detector de staleness do grafo.
 * O grafo (`graphify-out/graph.json`) fica DESATUALIZADO quando existe qualquer
 * arquivo de código do projeto mais novo que ele (mtime). Diretórios de artefato
 * (graphify-out, .git, node_modules, dist, target, .next, .nuxt) não contam.
 */

async function makeProjectDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "repo-test-"));
}

async function setMtime(p: string, msAgo: number): Promise<void> {
  const t = new Date(Date.now() - msAgo);
  await fs.utimes(p, t, t);
}

async function writeGraphJson(dir: string, msAgo: number): Promise<void> {
  const graphDir = path.join(dir, "graphify-out");
  await fs.mkdir(graphDir, { recursive: true });
  const graphJson = path.join(graphDir, "graph.json");
  await fs.writeFile(graphJson, "{}\n");
  await setMtime(graphJson, msAgo);
}

async function writeSource(dir: string, rel: string, msAgo = 0): Promise<void> {
  const p = path.join(dir, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, "content\n");
  if (msAgo > 0) await setMtime(p, msAgo);
}

describe("computeGraphStaleness (Fase 5 — detector de staleness)", () => {
  it("sem graph.json → não desatualizado (0 mudanças)", async () => {
    const dir = await makeProjectDir();
    try {
      await expect(computeGraphStaleness(dir)).resolves.toEqual({ stale: false, changedCount: 0 });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("graph.json mais novo que todas as fontes → não desatualizado", async () => {
    const dir = await makeProjectDir();
    try {
      await writeSource(dir, path.join("src", "a.ts"), 60_000);
      await writeGraphJson(dir, 1_000);
      await expect(computeGraphStaleness(dir)).resolves.toEqual({ stale: false, changedCount: 0 });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("fonte mais nova que o graph.json → desatualizado com a contagem", async () => {
    const dir = await makeProjectDir();
    try {
      await writeGraphJson(dir, 60_000);
      await writeSource(dir, path.join("src", "a.ts"));
      await expect(computeGraphStaleness(dir)).resolves.toEqual({ stale: true, changedCount: 1 });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("ignora diretórios de artefato (graphify-out/.git/node_modules/dist)", async () => {
    const dir = await makeProjectDir();
    try {
      await writeGraphJson(dir, 60_000);
      // Fontes novas dentro de diretórios ignorados NÃO contam.
      await writeSource(dir, path.join("graphify-out", "extra.js"));
      await writeSource(dir, path.join("node_modules", "x", "index.js"));
      await writeSource(dir, path.join(".git", "index"));
      await writeSource(dir, path.join("dist", "bundle.js"));
      // Única fonte real de código mudou.
      await writeSource(dir, path.join("src", "a.ts"));
      await expect(computeGraphStaleness(dir)).resolves.toEqual({ stale: true, changedCount: 1 });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

// ── T1 (Fase 4 — E4): snapshot/restore + unifiedDiff ──────────────────────

describe("Repo snapshot / restore (Fase 4 — crise)", () => {
  it("snapshot de arquivo existente retorna o conteúdo", async () => {
    const dir = await makeProjectDir();
    try {
      const repo = new Repo(dir);
      await repo.write("TODO_BATCH.md", "- [ ] T1\n- [ ] T2\n");
      const snap = await repo.snapshot("TODO_BATCH.md");
      expect(snap).toBe("- [ ] T1\n- [ ] T2\n");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("snapshot de arquivo inexistente retorna null", async () => {
    const dir = await makeProjectDir();
    try {
      const repo = new Repo(dir);
      const snap = await repo.snapshot("inexistente.md");
      expect(snap).toBeNull();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("restore escreve o conteúdo de volta", async () => {
    const dir = await makeProjectDir();
    try {
      const repo = new Repo(dir);
      await repo.write("TODO_BATCH.md", "original\n");
      await repo.restore("TODO_BATCH.md", "restaurado\n");
      const content = await repo.read("TODO_BATCH.md");
      expect(content).toBe("restaurado\n");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("restore com caminho fora do projeto lança erro", async () => {
    const dir = await makeProjectDir();
    try {
      const repo = new Repo(dir);
      await expect(repo.restore("../fora.md", "x")).rejects.toThrow("Caminho fora do projeto");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("unifiedDiff (Fase 4 — crise)", () => {
  it("textos iguais → diff vazio", () => {
    const before = "linha1\nlinha2\n";
    const after = "linha1\nlinha2\n";
    expect(unifiedDiff(before, after)).toBe("");
  });

  it("linha removida → prefixo -", () => {
    const before = "linha1\nlinha2\n";
    const after = "linha1\n";
    const diff = unifiedDiff(before, after);
    expect(diff).toContain("--- a/TODO_BATCH.md");
    expect(diff).toContain("+++ b/TODO_BATCH.md");
    expect(diff).toContain("-linha2");
  });

  it("linha adicionada → prefixo +", () => {
    const before = "linha1\n";
    const after = "linha1\nlinha2\n";
    const diff = unifiedDiff(before, after);
    expect(diff).toContain("+linha2");
  });

  it("mistura de adições e remoções", () => {
    const before = "- [ ] T1\n- [ ] T2\n- [ ] T3\n";
    const after = "- [ ] T1\n- [x] T2\n- [ ] T4\n";
    const diff = unifiedDiff(before, after);
    expect(diff).toContain("- [ ] T1");
    expect(diff).toContain("-- [ ] T2");
    expect(diff).toContain("+- [x] T2");
    expect(diff).toContain("-- [ ] T3");
    expect(diff).toContain("+- [ ] T4");
  });

  it("trunca no maxLen quando fornecido", () => {
    const before = "a\nb\nc\nd\ne\nf\n";
    const after = "x\ny\nz\nw\nv\nu\n";
    const diff = unifiedDiff(before, after, 50);
    expect(diff.length).toBeLessThanOrEqual(50 + "\n…(truncado)".length);
    expect(diff).toContain("…(truncado)");
  });

  it("não trunca quando maxLen é maior que o diff", () => {
    const before = "a\n";
    const after = "b\n";
    const diff = unifiedDiff(before, after, 500);
    expect(diff).not.toContain("truncado");
  });

  it("snapshot null (arquivo não existia) → before é string vazia", () => {
    const before = "";
    const after = "- [ ] T1\n";
    const diff = unifiedDiff(before, after);
    expect(diff).toContain("+- [ ] T1");
  });
});
