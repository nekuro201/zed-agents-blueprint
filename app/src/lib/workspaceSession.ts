import { z } from "zod";

export interface WorkspaceSession {
  name: string;
  path: string;
  openedAt: number;
}

export const RECENTS_KEY = "pi-factory:recents";

const SessionSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  openedAt: z.number(),
});

const RecentsSchema = z.array(SessionSchema);

export function parseSession(raw: unknown): WorkspaceSession | null {
  const result = SessionSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function loadRecents(): WorkspaceSession[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    return RecentsSchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveRecents(list: WorkspaceSession[]): void {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(RecentsSchema.parse(list)));
}

export function upsertRecent(input: { name: string; path: string }): WorkspaceSession {
  const next: WorkspaceSession = { name: input.name, path: input.path, openedAt: Date.now() };
  const rest = loadRecents().filter((item) => item.path !== next.path);
  const list = [next, ...rest];
  saveRecents(list);
  return next;
}

export function removeRecent(path: string): void {
  saveRecents(loadRecents().filter((item) => item.path !== path));
}
