import type { AgentRole, EngineEvent } from "./protocol.js";
import type { Gate } from "./orchestrator.js";
import { StopSignal, checkpoint } from "./orchestrator.js";
import { generateGraphFor } from "./graph.js";

/**
 * Modo simulado (PI_ENGINE_MOCK=1 ou --mock).
 * Emite um fluxo pré-gravado e realista de eventos para desenvolvimento da UI
 * sem credenciais do DevPass nem configuração do pi. Respeita pause/inject/stop.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MockPhase {
  fase: string;
  toolEdits: string[];
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
      emit({ type: "agent-end", role: "techlead", stats: { tokens: { input: 4200, output: 640, total: 4840 }, cost: 0.0012 } });

      // CODER (loop de uma tentativa bem-sucedida)
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
      emit({ type: "agent-end", role: "coder", stats: { tokens: { input: 9800, output: 2140, total: 11940 }, cost: 0.0031 } });

      // FASE CONCLUÍDA + COMMIT
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
