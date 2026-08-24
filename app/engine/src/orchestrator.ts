import { execFile } from "node:child_process";
import { z } from "zod";
import { agentRun, structured } from "./pi.js";
import type { AgentModels, AgentRole, EngineEvent } from "./protocol.js";
import { buildSkillPrompt } from "./skills.js";
import { Repo, markPhaseDone, nextPendingPhase, planProgress } from "./repo.js";

/**
 * Orquestrador — a máquina de estados do fluxo "fábrica de software autônoma",
 * uma reescrita em processo do `configs/automacao.js`, usando o SDK do pi.
 *
 * Flutxo (igual ao script original):
 *   ler próxima fase do PLAN.md -> techlead gera TODO_BATCH.md ->
 *   loop do coder (máx. 3 tentativas) -> testador verifica ->
 *   QA judge (veredito TDD) -> marcar fase concluída + git commit ->
 *   em estouro: protocolo de crise (modelo sênior) + pausa p/ auditoria humana.
 *
 * Diferenças intencionais vs. o script:
 *   - parse estruturado com Zod (reader/QA) — zero regex sobre texto de LLM.
 *   - edição de estado do PLAN.md feita de forma determinística (não via LLM).
 *   - eventos em streaming para a UI + human-in-the-loop (pause/inject/stop).
 *   - verificação de testes pelo agente testador (skill `testador`): roda a suíte
 *     real quando existe, ou inspeciona os entregáveis em projetos simples.
 */

export const DEFAULT_MODEL = process.env.PI_DEFAULT_MODEL ?? "llmgateway/deepseek-v4-flash";
export const CRISIS_MODEL = process.env.PI_CRISIS_MODEL ?? "llmgateway/deepseek-v4-flash";
export const MAX_TENTATIVAS_ERRO = 3;

const ReaderSchema = z.object({
  fase: z.string().nullable().describe('Nome curto da primeira fase pendente (ex: "Fase 1"). Null se todas concluídas.'),
  concluido: z.boolean().describe("True se todas as fases do PLAN.md estiverem concluídas."),
});

const QaSchema = z.object({
  veredito: z.enum(["ESPERADO", "INESPERADO"]),
  justificativa: z.string().describe("Explicação curta da decisão de QA."),
});

/** Portão de controle humano (pause/inject/stop). */
export interface Gate {
  paused: boolean;
  pendingInjections: string[];
  stopRequested: boolean;
  resumeWaiters: Array<() => void>;
  stopHandlers: Array<() => void>;
}

export function createGate(): Gate {
  return { paused: false, pendingInjections: [], stopRequested: false, resumeWaiters: [], stopHandlers: [] };
}

export class StopSignal extends Error {
  constructor() {
    super("Execução interrompida pelo usuário.");
  }
}

export function triggerPause(gate: Gate): void {
  gate.paused = true;
}

export function triggerResume(gate: Gate): void {
  gate.paused = false;
  const waiters = gate.resumeWaiters.splice(0);
  waiters.forEach((w) => w());
}

export function queueInjection(gate: Gate, text: string): void {
  gate.pendingInjections.push(text);
}

export function triggerStop(gate: Gate): void {
  gate.stopRequested = true;
  gate.paused = false;
  const waiters = gate.resumeWaiters.splice(0);
  waiters.forEach((w) => w());
  gate.stopHandlers.slice().forEach((h) => h());
}

/**
 * Ponto de pausa seguro antes de cada passo do agente.
 * - Retorna a injeção pendente (ou null) para ser prefixada no próximo prompt.
 * - Se pausado, bloqueia até resume/stop.
 */
export async function checkpoint(gate: Gate, emit: (e: EngineEvent) => void, at: string): Promise<string | null> {
  void at;
  if (gate.stopRequested) throw new StopSignal();
  const collect = () => {
    if (gate.pendingInjections.length === 0) return null;
    const t = gate.pendingInjections.join("\n\n-------\n\n");
    gate.pendingInjections = [];
    return t;
  };
  const immediate = collect();

  if (!gate.paused) return immediate;

  emit({ type: "status", status: "waiting", detail: "Pausado pelo usuário. Clique em Retomar." });
  emit({ type: "paused" });
  await new Promise<void>((resolve) => gate.resumeWaiters.push(resolve));

  if (gate.stopRequested) throw new StopSignal();
  emit({ type: "resumed" });
  emit({ type: "status", status: "running" });

  return collect() ?? immediate;
}

export interface OrchestratorOptions {
  projectDir: string;
  emit: (e: EngineEvent) => void;
  gate: Gate;
  mock?: boolean;
  /** Override de modelo por papel (vindo da UI). Ausente = default do engine. */
  models?: AgentModels;
}

function truncate(s: string, n = 6000): string {
  return s.length > n ? s.slice(0, n) + "\n…(truncado)" : s;
}

export async function runOrchestrator(opts: OrchestratorOptions): Promise<void> {
  const { projectDir, gate } = opts;
  const emit = opts.emit;
  const repo = new Repo(projectDir);
  const abort = new AbortController();
  const onStop = () => abort.abort();
  gate.stopHandlers.push(onStop);
  const signal = abort.signal;

  /** Resolve o modelo do papel: override da UI > default do engine. */
  const modelFor = (role: AgentRole): string => {
    if (role === "crise") return opts.models?.crise ?? CRISIS_MODEL;
    return opts.models?.[role] ?? DEFAULT_MODEL;
  };

  try {
    let crise = false;
    emit({ type: "status", status: "starting", detail: "Lendo PLAN.md…" });

    const agentsMd = await repo.read("AGENTS.md");
    const runStructured = <T>(role: AgentRole, prompt: string, schema: z.ZodType<T>) =>
      structured<T>({ role, projectDir, prompt, schema, model: modelFor(role), onEvent: emit, signal });

    while (true) {
      const plan = await repo.read("PLAN.md");
      if (!plan) {
        emit({ type: "error", message: `PLAN.md não encontrado no diretório do projeto: ${projectDir}` });
        return;
      }

      const prog = planProgress(plan);
      const local = nextPendingPhase(plan);
      const fase = local?.title ?? null;
      emit({
        type: "phase",
        fase,
        total: prog.total,
        done: prog.done,
        pct: prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0,
      });

      let faseAtiva = fase;
      if (!faseAtiva) {
        // Fallback: agente leitor estruturado (Zod) quando o parse local não encontra.
        emit({ type: "log", level: "info", message: "Parse local do PLAN.md não encontrou fase pendente; consultando o agente leitor…" });
        const extra =
          agentsMd ? `\n\nAGENTS.md do projeto:\n${truncate(agentsMd, 2000)}` : "";
        const reader = await runStructured(
          "leitor",
          `Leia o PLAN.md abaixo e identifique a PRIMEIRA fase pendente ([ ] no título).\n\n` +
            `Responda APENAS com um JSON com EXATAMENTE estes campos (sem markdown, sem texto fora do JSON):\n` +
            `- "fase": string com o nome da primeira fase pendente, ou null se todas concluídas\n` +
            `- "concluido": true ou false\n` +
            `Exemplo: {"fase": "Fase 1", "concluido": false}\n\n` +
            `${plan}${extra}`,
          ReaderSchema,
        );
        faseAtiva = reader.concluido || !reader.fase ? null : reader.fase;
      }

      if (!faseAtiva) {
        emit({ type: "done", message: "🎉 Todas as fases do PLAN.md estão concluídas. Projeto finalizado!" });
        return;
      }

      emit({ type: "phase-start", fase: faseAtiva });
      emit({ type: "log", level: "info", message: `🎯 FASE ATIVA: ${faseAtiva}` });

      // 1) TECHLEAD — fatiar a fase em TODO_BATCH.md
      await checkpoint(gate, emit, "techlead");
      const techPrompt = await buildSkillPrompt({
        name: "techlead",
        projectDir,
        agentsMd,
        instruction: `Leia a ${faseAtiva} do PLAN.md e gere o TODO_BATCH.md correspondente a ela, seguindo o formato obrigatório das skills: tarefas atômicas com checkboxes (- [ ]), RED/GREEN Phase quando houver testes, e a tag de engine recomendada no topo.`,
      });
      await agentRun({ role: "techlead", projectDir, prompt: techPrompt, model: modelFor("techlead"), onEvent: emit, signal });

      // 2) CODER — loop de execução + testes
      let sucesso = false;
      let tentativa = 1;
      while (tentativa <= MAX_TENTATIVAS_ERRO && !sucesso) {
        const injection = await checkpoint(gate, emit, `coder tentativa ${tentativa}`);

        const instrucao =
          tentativa === 1
            ? "Cumpra rigorosamente as tarefas do TODO_BATCH.md."
            : "O último teste falhou. Leia o error.log e corrija a implementação.";
        const comInjecao = [`[Tentativa ${tentativa}/${MAX_TENTATIVAS_ERRO}] ${instrucao}`]
          .concat(injection ? [`\nORIENTAÇÃO DO USUÁRIO (prioridade máxima):\n${injection}`] : [])
          .join("\n");

        const coderPrompt = await buildSkillPrompt({
          name: "coder",
          projectDir,
          agentsMd,
          instruction: comInjecao,
        });
        await agentRun({ role: "coder", projectDir, prompt: coderPrompt, model: modelFor("coder"), onEvent: emit, signal });

        // 3) VERIFICAÇÃO — agente testador (skill `testador`): roda a suíte real
        //    quando existe ou inspeciona os entregáveis em projetos simples.
        const result = await runTestador({ projectDir, emit, gate, signal, agentsMd, models: opts.models });
        if (result.ok) {
          sucesso = true;
          break;
        }

        await repo.write("error.log", result.output || "Erro desconhecido na verificação.");
        emit({ type: "test", state: "fail" });
        emit({ type: "log", level: "warn", message: "❌ Verificação falhou. Log salvo em error.log." });

        // 4) QA JUDGE — veredito TDD estruturado (Zod)
        const qaPrompt =
          `Análise de TDD do fluxo.\n` +
          `- ESPERADO: falha natural de funcionalidade ainda não implementada pelo Coder.\n` +
          `- INESPERADO: erro de sintaxe, crash de módulo, erro de tipagem ou regressão de código antigo.\n\n` +
          `Responda APENAS com um JSON com EXATAMENTE estes campos (sem markdown, sem texto fora do JSON):\n` +
          `- "veredito": "ESPERADO" ou "INESPERADO" (apenas um destes dois valores)\n` +
          `- "justificativa": string com a explicação curta da decisão\n` +
          `Exemplo: {"veredito": "ESPERADO", "justificativa": "Falha natural de funcionalidade ainda não implementada."}\n\n` +
          `[error.log]\n${truncate(result.output, 6000)}\n\n` +
          `[TODO_BATCH.md]\n${truncate((await repo.read("TODO_BATCH.md")) ?? "Sem batch atual.", 4000)}`;

        const veredito = await runStructured("qa", qaPrompt, QaSchema);
        emit({ type: "qa-verdict", veredito: veredito.veredito, justificativa: veredito.justificativa });

        if (veredito.veredito === "ESPERADO") {
          emit({ type: "log", level: "info", message: "⏭️ Erro TDD esperado. O Coder continuará implementando…" });
          continue;
        }
        emit({ type: "log", level: "warn", message: "⚠️ Erro INESPERADO. O Coder tentará corrigir (perdeu uma tentativa)." });
        tentativa++;
      }

      // 5) FINALIZAÇÃO DA FASE ou PROTOCOLO DE CRISE
      if (sucesso) {
        // Relê o PLAN.md atual: o techlead pode ter marcado fases `[-]` (em
        // andamento) e editado o arquivo durante a execução. Marcar sobre a versão
        // atual preserva essas edições (a versão lida no início da iteração é velha).
        const planAtual = (await repo.read("PLAN.md")) ?? plan;
        const planAtualizado = markPhaseDone(planAtual, faseAtiva);
        await repo.write("PLAN.md", planAtualizado);
        emit({ type: "phase-done", fase: faseAtiva });
        emit({ type: "log", level: "info", message: `✅ ${faseAtiva} concluída com sucesso.` });

        const commitMsg = `feat: conclui ${faseAtiva} (via pi-factory)`;
        try {
          await execFileAsync("git", ["add", "."], projectDir);
          await execFileAsync("git", ["commit", "-m", commitMsg], projectDir);
          emit({ type: "commit", ok: true, message: commitMsg });
        } catch {
          emit({ type: "commit", ok: false, message: "Commit ignorado (sem alterações ou git não iniciado)." });
        }
      } else {
        emit({ type: "log", level: "error", message: `🚨 Protocolo de crise: o Coder falhou ${MAX_TENTATIVAS_ERRO}x na ${faseAtiva}.` });
        await checkpoint(gate, emit, "crise");
        const crisePrompt = await buildSkillPrompt({
          name: "techlead",
          projectDir,
          agentsMd,
          instruction: `O Coder falhou ${MAX_TENTATIVAS_ERRO} vezes consecutivas na ${faseAtiva}. Leia o error.log e reavalie o TODO_BATCH.md, simplificando o escopo ou corrigindo o teste quebrado.`,
        });
        await agentRun({ role: "crise", projectDir, prompt: crisePrompt, model: modelFor("crise"), thinkingLevel: "medium", onEvent: emit, signal });

        emit({ type: "crisis", message: "Novo plano gerado pelo modelo sênior. Execução pausada para auditoria humana." });
        emit({ type: "status", status: "done", detail: "Protocolo de crise — auditoria humana necessária." });
        crise = true;
        break;
      }
    }

    if (!crise) {
      emit({ type: "done", message: "🎉 Todas as fases do PLAN.md estão concluídas. Projeto finalizado!" });
    }
  } catch (err) {
    if (err instanceof StopSignal) {
      emit({ type: "status", status: "done", detail: "Execução interrompida pelo usuário." });
      emit({ type: "log", level: "info", message: "⏹️ Execução parada pelo usuário." });
    } else {
      emit({ type: "error", message: (err as Error).message });
    }
  } finally {
    const idx = gate.stopHandlers.indexOf(onStop);
    if (idx >= 0) gate.stopHandlers.splice(idx, 1);
  }
}

const TestResultSchema = z.object({
  ok: z.boolean(),
  output: z.string().default(""),
});

/**
 * Passo de verificação: o agente testador (skill `testador`) decide a estratégia —
 * roda a suíte de testes reais se existir, ou inspeciona os entregáveis do
 * TODO_BATCH.md diretamente em projetos simples — e escreve test-result.json.
 * Sem comando de teste padrão: nada é executado por default além do que o agente
 * julgar necessário.
 */
async function runTestador(opts: {
  projectDir: string;
  emit: (e: EngineEvent) => void;
  gate: Gate;
  signal: AbortSignal;
  agentsMd: string | null;
  models?: AgentModels;
}): Promise<{ ok: boolean; output: string }> {
  const { projectDir, emit, gate, signal, agentsMd, models } = opts;

  emit({ type: "log", level: "info", message: "🔎 Agente testador verificando a fase (testes reais ou entregáveis do TODO_BATCH.md)…" });
  emit({ type: "test", state: "start" });
  await checkpoint(gate, emit, "testador");
  const skillPrompt = await buildSkillPrompt({
    name: "testador",
    projectDir,
    agentsMd,
    instruction:
      `Verifique se a fase atual do TODO_BATCH.md foi cumprida de fato. ` +
      `Leia o TODO_BATCH.md e o AGENTS.md, decida a estratégia (rodar a suíte de testes reais se existir, ` +
      `ou inspecionar os entregáveis em casos simples) e escreva o resultado em test-result.json ` +
      `no formato {"ok": true|false, "output": "resumo objetivo"}.`,
  });
  await agentRun({ role: "testador", projectDir, prompt: skillPrompt, model: models?.testador ?? DEFAULT_MODEL, onEvent: emit, signal });

  let result: { ok: boolean; output: string };
  const raw = await new Repo(projectDir).read("test-result.json");
  if (!raw) {
    result = { ok: false, output: "O agente testador não produziu test-result.json." };
  } else {
    try {
      const parsed = TestResultSchema.safeParse(JSON.parse(raw));
      result = parsed.success
        ? { ok: parsed.data.ok, output: parsed.data.output }
        : { ok: false, output: `test-result.json inválido: ${parsed.error.message}` };
    } catch {
      result = { ok: false, output: "test-result.json não é um JSON válido." };
    }
  }
  emit({ type: "test", state: result.ok ? "ok" : "fail" });
  return result;
}

function execFileAsync(file: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd, timeout: 60_000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/**
 * Gera o PLAN.md a partir de um escopo escrito (composer do Planejador — 2.5).
 * - mock: grava um PLAN.md de exemplo (sem LLM) e encerra.
 * - real: roda o skill `planejador` em sessão com ferramentas (escreve o arquivo).
 */
export async function generatePlan(opts: {
  projectDir: string;
  prompt: string;
  emit: (e: EngineEvent) => void;
  mock: boolean;
  /** Modelo do Planejador (vindo da UI). Ausente = default do engine. */
  model?: string;
}): Promise<void> {
  const { projectDir, prompt, emit, mock, model } = opts;
  emit({ type: "status", status: "starting", detail: "Planejador gerando o PLAN.md…" });

  if (mock) {
    const titulo = prompt.trim().split(/\s+/).slice(0, 6).join(" ") || "Projeto";
    await new Repo(projectDir).write(
      "PLAN.md",
      `# PLAN\n\n## [ ] Fase 1 — ${titulo}\n`,
    );
    emit({ type: "plan-done", projectDir });
    emit({ type: "status", status: "idle" });
    emit({ type: "log", level: "info", message: "PLAN.md de exemplo criado (modo simulado). Vá ao Loop e clique em Iniciar." });
    return;
  }

  const repo = new Repo(projectDir);
  const agentsMd = await repo.read("AGENTS.md");
  const skillPrompt = await buildSkillPrompt({
    name: "planejador",
    projectDir,
    agentsMd,
    instruction: `Crie o arquivo PLAN.md a partir do pedido abaixo, no formato obrigatório da skill (fases ## com marcador [ ] no título e tags de complexidade).\n\nPEDIDO:\n${prompt}`,
  });
  const abort = new AbortController();
  await agentRun({ role: "planejador", projectDir, prompt: skillPrompt, model, onEvent: emit, signal: abort.signal });
  emit({ type: "plan-done", projectDir });
  emit({ type: "status", status: "idle" });
}
