import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { computeGraphStaleness } from "./repo";

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
