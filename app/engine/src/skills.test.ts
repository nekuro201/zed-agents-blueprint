import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildSkillPrompt } from "./skills";

/**
 * Fase 3 — injeção do `graphify-out/GRAPH_REPORT.md` no prompt dos agentes.
 * O relatório é um auxílio de navegação (nunca fonte da verdade): injetado
 * apenas quando presente, rotulado como "mapa de arquitetura (pode estar atrasado)".
 */

async function makeProjectDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-test-"));
  // Skill do coder resolvida de forma determinística a partir do próprio projeto.
  await fs.mkdir(path.join(dir, ".agents", "skills", "coder"), { recursive: true });
  await fs.writeFile(path.join(dir, ".agents", "skills", "coder", "SKILL.md"), "# coder skill\n");
  return dir;
}

async function writeGraphReport(dir: string): Promise<void> {
  await fs.mkdir(path.join(dir, "graphify-out"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "graphify-out", "GRAPH_REPORT.md"),
    "# Mapa de arquitetura\n\n- módulo A\n- módulo B\n",
  );
}

describe("buildSkillPrompt (injeção do GRAPH_REPORT)", () => {
  it("injeta o GRAPH_REPORT.md rotulado como mapa de arquitetura quando presente", async () => {
    const dir = await makeProjectDir();
    try {
      await writeGraphReport(dir);
      const prompt = await buildSkillPrompt({
        name: "coder",
        projectDir: dir,
        instruction: "Implemente X.",
        agentsMd: "# AGENTS\n",
      });

      expect(prompt).toContain("mapa de arquitetura (pode estar atrasado)");
      expect(prompt).toContain("- módulo A");
      expect(prompt).toContain("- módulo B");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("ignora o bloco do grafo quando o relatório está ausente (sem lançar)", async () => {
    const dir = await makeProjectDir();
    try {
      const prompt = await buildSkillPrompt({
        name: "coder",
        projectDir: dir,
        instruction: "Implemente X.",
        agentsMd: "# AGENTS\n",
      });

      expect(prompt).not.toContain("mapa de arquitetura (pode estar atrasado)");
      expect(prompt).not.toContain("- módulo A");
      // O restante do prompt continua íntegro.
      expect(prompt).toContain("TAREFA AGORA:\nImplemente X.");
      expect(prompt).toContain("# coder skill");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("avisa quando o mapa está desatualizado (fonte mais nova que o graph.json)", async () => {
    const dir = await makeProjectDir();
    try {
      await writeGraphReport(dir);

      // graph.json antigo (a geração aconteceu antes das mudanças).
      await fs.writeFile(path.join(dir, "graphify-out", "graph.json"), "{}\n");
      const old = new Date(Date.now() - 60_000);
      await fs.utimes(path.join(dir, "graphify-out", "graph.json"), old, old);

      // Fonte de código editada depois da geração.
      await fs.mkdir(path.join(dir, "src"), { recursive: true });
      await fs.writeFile(path.join(dir, "src", "a.ts"), "export const x = 1;\n");

      const prompt = await buildSkillPrompt({
        name: "coder",
        projectDir: dir,
        instruction: "Implemente X.",
        agentsMd: "# AGENTS\n",
      });

      // Mantém o rótulo já contratado + acrescenta o aviso de staleness.
      expect(prompt).toContain("mapa de arquitetura (pode estar atrasado)");
      expect(prompt).toContain("DESATUALIZADO");
      expect(prompt).toContain("Confirme com read antes de editar");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
