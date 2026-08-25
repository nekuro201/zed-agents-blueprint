import fs from "node:fs/promises";
import path from "node:path";
import { Repo, computeGraphStaleness } from "./repo.js";

export type SkillName = "planejador" | "techlead" | "coder" | "testador";

/**
 * Localiza o conteúdo do SKILL.md de uma skill local.
 *
 * Ordem de busca (primeiro que existir vence):
 *  1. `PI_SKILLS_DIR/<name>/SKILL.md`          — override via env
 *  2. `<projectDir>/.agents/skills/<name>/SKILL.md` — skills injetadas no projeto (install.sh)
 *  3. `<appRoot>/../skills/<name>/SKILL.md`    — skills do blueprint (este repo)
 *
 * O engine injeta o conteúdo como "system prompt" equivalente ao que o Zed
 * usaria ao chamar /planejador, /techlead e /coder — assim os agentes continuam
 * seguindo as regras exatas das skills, mas orquestrados em processo.
 */
export async function resolveSkill(
  name: SkillName,
  projectDir: string,
): Promise<string | null> {
  const candidates: string[] = [];
  if (process.env.PI_SKILLS_DIR) {
    candidates.push(path.join(process.env.PI_SKILLS_DIR, name, "SKILL.md"));
  }
  candidates.push(path.join(projectDir, ".agents", "skills", name, "SKILL.md"));

  // appRoot = diretório pai do engine/ (caminho relativo robusto a partir do bundle/built)
  const engineRoot = import.meta.url.startsWith("file:")
    ? path.dirname(new URL(import.meta.url).pathname)
    : process.cwd();
  // O bundle fica em app/engine/dist/index.mjs -> sobe 2 níveis para app/
  const appRoot = path.resolve(engineRoot, "..", "..");
  candidates.push(path.join(appRoot, "..", "skills", name, "SKILL.md"));

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf-8");
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

/**
 * Monta o prompt do agente: skill (system) + AGENTS.md do projeto + instrução.
 * Um único bloco de texto para o SDK (o AgentSession não expõe setSystemPrompt
 * público nesta versão; pré-incluímos tudo no prompt textual).
 */
export async function buildSkillPrompt(opts: {
  name: SkillName | "leitor" | "qa";
  projectDir: string;
  instruction: string;
  agentsMd?: string | null;
}): Promise<string> {
  const { name, projectDir, instruction, agentsMd } = opts;
  const blocks: string[] = [];

  if (name === "leitor" || name === "qa") {
    // Agentes de análise estruturada (Zod): regras inline, sem ferramentas.
    blocks.push(leitorOuQa(name));
  } else {
    const skill = await resolveSkill(name, projectDir);
    if (skill) {
      blocks.push(
        `Estas são as REGRAS DA SKILL que você deve seguir rigorosamente (fonte da verdade comportamental):\n\n${skill}`,
      );
    }
  }

  if (agentsMd) {
    blocks.push(
      `Este é o AGENTS.md do projeto (fonte da verdade arquitetural — siga estritamente):\n\n${agentsMd}`,
    );
  }

  // Grafo de conhecimento (Graphify) = auxílio de navegação, NUNCA fonte da
  // verdade. Injetamos apenas o resumo compacto (GRAPH_REPORT.md) — nunca o
  // graph.json inteiro — e deixamos claro que ele pode estar atrasado. Quando o
  // detector de staleness acusar mudanças, avisamos explicitamente o agente para
  // confirmar com read antes de editar.
  const graphReport = await new Repo(projectDir).read(path.join("graphify-out", "GRAPH_REPORT.md"));
  if (graphReport) {
    const staleness = await computeGraphStaleness(projectDir);
    const staleWarning = staleness.stale
      ? `\n\nAVISO: este mapa está DESATUALIZADO — ${staleness.changedCount} arquivo(s) do código mudaram após a geração. Confirme com read antes de editar.`
      : "";
    blocks.push(
      `Este é o mapa de arquitetura (pode estar atrasado) do projeto — use-o como auxílio de navegação e confirme com read antes de editar:${staleWarning}\n\n${graphReport}`,
    );
  }

  blocks.push(`TAREFA AGORA:\n${instruction}`);

  return blocks.join("\n\n---\n\n");
}

function leitorOuQa(name: "leitor" | "qa"): string {
  if (name === "leitor") {
    return [
      "Você é o AGENTE LEITOR do fluxo de automação de software.",
      "Analisa o PLAN.md e identifica a PRIMEIRA fase pendente (marcada com [ ] no título).",
      "Responda APENAS o JSON pedido — sem markdown, sem explicações fora do JSON.",
    ].join("\n");
  }
  return [
    "Você é o JUIZ DE TDD do fluxo de automação de software.",
    "Analisa log de testes (error.log) contra o TODO_BATCH.md para decidir se a falha é esperada ou não.",
    "Responda APENAS o JSON pedido — sem markdown, sem explicações fora do JSON.",
  ].join("\n");
}
