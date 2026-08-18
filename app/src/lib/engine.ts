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

export function onEngineEvent(cb: (payload: string) => void): Promise<UnlistenFn> {
  return listen<string>("engine-event", (ev) => cb(ev.payload));
}

export function onEngineLog(cb: (payload: string) => void): Promise<UnlistenFn> {
  return listen<string>("engine-log", (ev) => cb(ev.payload));
}

export function onEngineExit(cb: () => void): Promise<UnlistenFn> {
  return listen("engine-exit", () => cb());
}
