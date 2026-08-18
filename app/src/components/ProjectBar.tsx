import { open } from "@tauri-apps/plugin-dialog";

import { FolderOpen } from "lucide-react";

export function ProjectBar({
  value,
  onChange,
  onBrowse,
}: {
  value: string;
  onChange: (v: string) => void;
  onBrowse: () => Promise<void> | void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/caminho/para/o/projeto (contém PLAN.md e AGENTS.md)"
        spellCheck={false}
        className="w-full rounded-lg border border-edge bg-panel px-3 py-1.5 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
      />
      <button
        onClick={() => void onBrowse()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-accent/60"
      >
        <FolderOpen size={14} aria-hidden /> Abrir…
      </button>
    </div>
  );
}

export async function pickDirectory(): Promise<string | null> {
  try {
    const dir = await open({ directory: true, multiple: false, title: "Selecione o projeto-alvo" });
    if (typeof dir === "string") return dir;
    return null;
  } catch {
    return null;
  }
}
