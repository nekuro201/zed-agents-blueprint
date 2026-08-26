import readline from "node:readline";
import { EngineCommandSchema, emit, type EngineCommand, type EngineEvent } from "./protocol.js";
import { createGate, generatePlan, runOrchestrator, queueInjection, triggerPause, triggerResume, triggerStop, triggerCrisisAccept, triggerCrisisRevert } from "./orchestrator.js";
import { runMock } from "./mock.js";
import { generateGraphFor } from "./graph.js";
import { fetchModelsList, registerModelInPiAgent } from "./models.js";

export const ENGINE_VERSION = "0.1.0";

interface CliArgs {
  projectDir: string | null;
  mock: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { projectDir: null, mock: process.env.PI_ENGINE_MOCK === "1" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--project-dir=")) {
      args.projectDir = a.slice("--project-dir=".length);
    } else if (a === "--project-dir") {
      args.projectDir = argv[++i] ?? null;
    } else if (a === "--mock") {
      args.mock = true;
    } else if (a === "--version" || a === "-v") {
      console.log(ENGINE_VERSION);
      process.exit(0);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const gate = createGate();
  let running = false;

  emit({ type: "ready", version: ENGINE_VERSION, mock: args.mock, projectDir: args.projectDir });

  const run = async (cmd: Extract<EngineCommand, { type: "start" }>): Promise<void> => {
    if (running) {
      emit({ type: "log", level: "warn", message: "Já existe uma execução em andamento. Use Stop antes de iniciar outra." });
      return;
    }
    running = true;

    const close = () => {
      emit({ type: "exit", code: null, reason: "finished" });
      running = false;
    };

    try {
      const emitEvent = (e: EngineEvent): void => emit(e);
      if (args.mock) {
        await runMock({ projectDir: cmd.projectDir, emit: emitEvent, gate });
      } else {
        await runOrchestrator({ projectDir: cmd.projectDir, emit: emitEvent, gate, models: cmd.models, thinking: cmd.thinking });
      }
    } catch (err) {
      emit({ type: "error", message: (err as Error).message });
    } finally {
      close();
    }
  };

  const runPlan = async (cmd: Extract<EngineCommand, { type: "plan" }>): Promise<void> => {
    if (running) {
      emit({ type: "log", level: "warn", message: "Já existe uma execução em andamento. Espere terminar ou dê Stop." });
      return;
    }
    running = true;
    try {
      await generatePlan({ projectDir: cmd.projectDir, prompt: cmd.prompt, emit, mock: args.mock, model: cmd.models?.planejador, thinking: cmd.thinking?.planejador });
    } catch (err) {
      emit({ type: "error", message: (err as Error).message });
    } finally {
      running = false;
    }
  };

  const runGraph = async (cmd: Extract<EngineCommand, { type: "graph" }>): Promise<void> => {
    await generateGraphFor(emit, cmd.projectDir);
  };

  const rl = readline.createInterface({ input: process.stdin });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let cmd: EngineCommand;
    try {
      cmd = EngineCommandSchema.parse(JSON.parse(trimmed));
    } catch (err) {
      emit({ type: "log", level: "warn", message: `Comando inválido ignorado: ${(err as Error).message}` });
      return;
    }

    switch (cmd.type) {
      case "start":
        void run(cmd);
        break;
      case "plan":
        void runPlan(cmd);
        break;
      case "graph":
        void runGraph(cmd);
        break;
      case "pause":
        if (running) {
          triggerPause(gate);
          emit({ type: "log", level: "info", message: "Pausa solicitada (aplica no próximo ponto seguro)." });
        }
        break;
      case "resume":
        if (running) {
          triggerResume(gate);
          emit({ type: "log", level: "info", message: "Retomada solicitada." });
        }
        break;
      case "inject":
        if (running) {
          queueInjection(gate, cmd.text);
          emit({ type: "injected", text: cmd.text });
          emit({ type: "log", level: "info", message: "Correção injetada: será aplicada no próximo passo do agente." });
        }
        break;
      case "stop":
        if (running) {
          emit({ type: "status", status: "stopping", detail: "Parando execução…" });
          triggerStop(gate);
          emit({ type: "log", level: "info", message: "Parando execução…" });
        }
        break;
      case "crisis-accept":
        if (running) {
          triggerCrisisAccept(gate);
          emit({ type: "log", level: "info", message: "✅ Crise aceita. Retomando o loop…" });
        }
        break;
      case "crisis-revert":
        if (running) {
          triggerCrisisRevert(gate);
          emit({ type: "log", level: "info", message: "↩️ Crise revertida. Encerrando para auditoria humana." });
        }
        break;
      case "models-list":
        void fetchModelsList();
        break;
      case "models-register":
        void registerModelInPiAgent(cmd).then((r) => {
          emit({ type: "log", level: r.ok ? "info" : "warn", message: r.message });
        });
        break;
      case "ping":
        emit({ type: "log", level: "debug", message: "pong" });
        break;
    }
  });

  rl.on("close", () => {
    // stdin fechou (aplicativo encerrando) — derruba o processo.
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    triggerStop(gate);
    process.exit(0);
  });
}

main().catch((err) => {
  emit({ type: "error", message: (err as Error).message });
});
