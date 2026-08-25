import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { EngineCommand } from "./protocol";

/**
 * Bridge com o engine via Tauri.
 * O Rust (`src-tauri/src/lib.rs`) sobe o sidecar Node e encaminha: eventos de
 * stdout -> `engine-event`, stderr -> `engine-log`, fim do processo -> `engine-exit`.
 */

export function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function engineStart(projectDir: string, mock: boolean): Promise<void> {
  await invoke("engine_start", { projectDir, mock });
}

export async function engineSend(command: EngineCommand): Promise<void> {
  await invoke("engine_send", { command: JSON.stringify(command) });
}

export async function engineStop(): Promise<void> {
  await invoke("engine_stop");
}

/** Leitura somente-leitura de um arquivo do projeto-alvo (inspector 2.3). */
export async function readProjectFile(projectDir: string, relativePath: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const text = await invoke<string>("read_project_file", { projectDir, relPath: relativePath });
    return text ?? null;
  } catch {
    return null;
  }
}

/** Leitura somente-leitura do `graph.html` do projeto-alvo (viewer do grafo — E3). */
export async function readGraphFile(projectDir: string, relativePath: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const text = await invoke<string>("read_graph_file", { projectDir, relPath: relativePath });
    return text ?? null;
  } catch {
    return null;
  }
}

export interface GraphStaleness {
  stale: boolean;
  changedCount: number;
}

/** Detector de staleness do grafo (E3, Fase 5) — comando Tauri `graph_staleness`. */
export async function graphStaleness(projectDir: string): Promise<GraphStaleness> {
  if (!isTauri()) return { stale: false, changedCount: 0 };
  try {
    return await invoke<GraphStaleness>("graph_staleness", { projectDir });
  } catch {
    return { stale: false, changedCount: 0 };
  }
}

export async function listGitBranches(projectDir: string): Promise<{ current: string; branches: string[] }> {
  if (!isTauri()) return { current: "", branches: [] };
  return invoke("git_branches", { projectDir });
}

export async function createGitBranch(projectDir: string, name: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("git_checkout_new", { projectDir, name });
}

export function onEngineEvent(cb: (payload: string) => void): Promise<UnlistenFn> {
  return listen<string>("engine-event", (ev) => cb(ev.payload));
}

export function onEngineLog(cb: (payload: string) => void): Promise<UnlistenFn> {
  return listen<string>("engine-log", (ev) => cb(ev.payload));
}

export function onEngineExit(cb: () => void): Promise<UnlistenFn> {
  return listen("engine-exit", () => cb());
}
