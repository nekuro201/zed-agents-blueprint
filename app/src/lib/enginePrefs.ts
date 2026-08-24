import { z } from "zod";

export const ENGINE_PREFS_KEY = "pi-factory:engine-prefs";

export interface EnginePrefs {
  mock: boolean;
  defaultModel: string;
}

export const DEFAULT_ENGINE_PREFS: EnginePrefs = {
  mock: false,
  defaultModel: "llmgateway/deepseek-v4-flash",
};

const Schema = z.object({
  mock: z.boolean(),
  defaultModel: z.string().min(1),
});

export function loadEnginePrefs(): EnginePrefs {
  try {
    const raw = localStorage.getItem(ENGINE_PREFS_KEY);
    if (!raw) return DEFAULT_ENGINE_PREFS;
    return Schema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_ENGINE_PREFS;
  }
}

export function saveEnginePrefs(prefs: EnginePrefs): void {
  localStorage.setItem(ENGINE_PREFS_KEY, JSON.stringify(Schema.parse(prefs)));
}
