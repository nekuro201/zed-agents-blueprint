import type { AgentRole, EngineEvent } from "./protocol.js";
import type { Gate } from "./orchestrator.js";
import { StopSignal, checkpoint } from "./orchestrator.js";
import { generateGraphFor } from "./graph.js";

/**
 * Modo simulado (PI_ENGINE_MOCK=1 ou --mock).
 * Emite um fluxo pré-gravado e realista de eventos para desenvolvimento da UI
 * sem credenciais do DevPass nem configuração do pi. Respeita pause/inject/stop.
 *
 * E4 — Atualizado com demonstração do protocolo de crise completo:
 * snapshot → crisis com diff → waiting → crisisWaiters (auto-accept em 2s ou revert).
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MockPhase {
  fase: string;
  toolEdits: string[];
  /** E4 — se true, a fase simula falha e dispara o protocolo de crise. */
  crise?: boolean;
}

const PHASES: MockPhase[] = [
  {
    fase: "Fase 1: Setup",
    toolEdits: ["packages/app/package.json", "packages/app/vite.config.ts"],
  },
  {
    fase: "Fase 2: Auth",
    toolEdits: ["packages/app/src/modules/auth/Auth.view.tsx", "packages/app/src/modules/auth/useAuth.viewModel.ts"],
  },
  {
    fase: "Fase 3: API",
    toolEdits: ["packages/app/src/shared/api/client.ts", "packages/app/src/modules/orders/orders.scheme.ts"],
    crise: true,
  },
];

function streamRole(emit: (e: EngineEvent) => void, role: AgentRole, model: string, attempt = 1, maxAttempts = 3): void {
  emit({ type: "agent-start", role, model, attempt, maxAttempts });
}

async function tokens(emit: (e: EngineEvent) => void, role: AgentRole, text: string, stepMs = 24): Promise<void> {
  for (const chunk of text) {
    emit({ type: "token", role, delta: chunk });
    if (chunk === " ") await sleep(stepMs * 0.5);
  }
}

async function thinking(emit: (e: EngineEvent) => void, role: AgentRole, text: string): Promise<void> {
  for (const word of text.split(" ")) {
    emit({ type: "thinking", role, delta: (word.length ? word + " " : " ") });
    await sleep(28);
  }
}

export async function runMock(opts: {
  projectDir: string;
  emit: (e: EngineEvent) => void;
  gate: Gate;
}): Promise<void> {
  const { emit } = opts;
  try {
    emit({ type: "status", status: "starting", detail: "Modo simulado (sem credenciais)." });
    await generateGraphFor(emit, opts.projectDir);

    let done = 0;
    const total = PHASES.length;

    for (let idx = 0; idx < PHASES.length; idx++) {
      const phase = PHASES[idx];

      await checkpoint(opts.gate, emit, "mock-phase");
      emit({ type: "phase", fase: phase.fase, total, done, pct: Math.round((done / total) * 100) });
      emit({ type: "phase-start", fase: phase.fase });

      // TECHLEAD
      streamRole(emit, "techlead", "llmgateway/deepseek-v4-flash");
      await thinking(emit, "techlead", "Vou fatiar a fase em tarefas atômicas seguindo o AGENTS.md do projeto. Identifico RED e GREEN phases e os arquivos-alvo.");
      await tokens(emit, "techlead", "TODO_BATCH.md gerado com 6 tarefas atômicas e engine recomendada [⚡ Flash].");
      await sleep(120);
      emit({ type: "tool-call", role: "techlead", tool: "read", args: "PLAN.md" });
      await sleep(60);
      emit({ type: "tool-result", role: "techlead", tool: "read", ok: true, summary: "Leu Fases e Sub-fases pendentes." });
      await sleep(60);
      emit({ type: "tool-call", role: "techlead", tool: "write", args: "TODO_BATCH.md" });
      await sleep(60);
      emit({ type: "tool-result", role: "techlead", tool: "write", ok: true, summary: "TODO_BATCH.md atualizado." });
      emit({ type: "agent-end", role: "techlead", stats: { tokens: { input: 4200, output: 640, total: 4840 }, cost: 0.0012 }, durationMs: 1200 });

      if (phase.crise) {
        // ── E4: Protocolo de crise simulado ──
        // Simula o coder falhando 3 vezes consecutivas
        emit({ type: "log", level: "error", message: `🚨 Protocolo de crise: o Coder falhou 3x na ${phase.fase}.` });
        emit({ type: "status", status: "running", stage: "crisis", detail: "Protocolo de crise acionado…" });
        await checkpoint(opts.gate, emit, "crise");
        await sleep(120);

        // Snapshot (simulado) e agente crise
        streamRole(emit, "crise", "llmgateway/deepseek-v4-flash");
        await thinking(emit, "crise", "Reavaliando o escopo e simplificando as tarefas que causaram as falhas. Reduzindo complexidade da fase.");
        await tokens(emit, "crise", "TODO_BATCH.md reescrito com escopo reduzido. Tarefa problemática foi removida.");
        await sleep(120);
        emit({ type: "tool-call", role: "crise", tool: "write", args: "TODO_BATCH.md" });
        await sleep(60);
        emit({ type: "tool-result", role: "crise", tool: "write", ok: true, summary: "TODO_BATCH.md reescrito pelo modelo sênior." });
        emit({ type: "agent-end", role: "crise", stats: { tokens: { input: 5600, output: 980, total: 6580 }, cost: 0.0018 }, durationMs: 1600 });

        // Emite crisis com diff
        emit({
          type: "crisis",
          message: "Novo plano gerado pelo modelo sênior. Revise as alterações abaixo.",
          diff: `--- a/TODO_BATCH.md\n+++ b/TODO_BATCH.md\n@@ -4,7 +4,5 @@\n > Complexidade: [🛠 Pro-Standard]\n \n-### [ ] T1 — Config de DB (complexa)\n-### [ ] T2 — Migrations\n+### [ ] T1 — Config de DB simplificada\n \n ### [ ] T3 — Endpoints REST`,
        });
        emit({ type: "status", status: "waiting", stage: "crisis", detail: "Protocolo de crise — aguardando decisão humana." });

        // Aguarda no crisisWaiters (simula timeout de 2s com auto-accept)
        const action = await Promise.race([
          new Promise<"accept" | "revert">((resolve) => {
            opts.gate.crisisWaiters.push(resolve);
          }),
          sleep(2000).then(() => "accept" as const),
        ]);

        if (action === "revert") {
          emit({ type: "log", level: "info", message: "↩️ TODO_BATCH.md restaurado para o estado anterior à crise. Encerrando para auditoria." });
          emit({ type: "status", status: "done", detail: "Protocolo de crise revertido — auditoria humana necessária." });
          break;
        }

        emit({ type: "log", level: "info", message: "✅ Crise aceita. Retomando o loop com o novo TODO_BATCH.md…" });
        emit({ type: "status", status: "running" });
        await sleep(200);
      } else {
        // CODER — simula uma falha transitória com retry antes da tentativa bem-sucedida
        emit({ type: "retry", role: "coder", attempt: 1, maxAttempts: 3, delayMs: 2500, reason: "ECONNREFUSED (simulado)" });
        await sleep(120);
        streamRole(emit, "coder", "llmgateway/deepseek-v4-flash", 1, 3);
        await checkpoint(opts.gate, emit, `coder tentativa 1`);
        await thinking(emit, "coder", "Cumprindo o TODO_BATCH.md: crio os testes primeiro (RED), depois a implementação (GREEN).");
        await tokens(emit, "coder", "Criando arquivos de teste para a fase. Aplicando diffs cirúrgicos nos módulos.");

        for (const file of phase.toolEdits) {
          await sleep(40);
          emit({ type: "tool-call", role: "coder", tool: "edit", args: file });
          await sleep(160);
          emit({ type: "tool-result", role: "coder", tool: "edit", ok: true, summary: "+42 −6  (aplicado)" });
        }

        // TESTES
        emit({ type: "test", state: "start" });
        await sleep(300);
        emit({ type: "test", state: "output", output: "Test Suites: 1 passed, 1 total\nTests: 4 passed, 4 total\n" });
        await sleep(120);
        emit({ type: "test", state: "ok" });
        emit({ type: "agent-end", role: "coder", stats: { tokens: { input: 9800, output: 2140, total: 11940 }, cost: 0.0031 }, durationMs: 1400 });
      }

      // FASE CONCLUÍDA + COMMIT (exceto se crise revertida)
      done += 1;
      emit({ type: "phase" as const, fase: idx === PHASES.length - 1 ? null : PHASES[idx + 1]!.fase, total, done, pct: Math.round((done / total) * 100) });
      emit({ type: "phase-done", fase: phase.fase });
      emit({ type: "commit", ok: true, message: `feat: conclui ${phase.fase} (via pi-factory)` });
      await generateGraphFor(emit, opts.projectDir);

      await sleep(350);
    }

    emit({ type: "status", status: "done" });
    emit({ type: "done", message: "🎉 Todas as fases do PLAN.md estão concluídas (simulação)." });
  } catch (err) {
    if (err instanceof StopSignal) {
      emit({ type: "status", status: "done", detail: "Execução interrompida pelo usuário." });
      emit({ type: "log", level: "info", message: "⏹️ Execução parada pelo usuário (simulação)." });
    } else {
      emit({ type: "error", message: (err as Error).message });
    }
  }
}
