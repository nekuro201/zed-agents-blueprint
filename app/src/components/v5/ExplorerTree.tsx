import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export type BranchStatus = "ok" | "run" | "new" | "err";

export interface ExplorerBranch {
  name: string;
  status: BranchStatus;
}

export interface ExplorerGroup {
  name: string;
  icon: LucideIcon;
  branches: ExplorerBranch[];
}

const DOT: Record<BranchStatus, string> = {
  ok: "bg-zinc-500",
  run: "bg-amber-400",
  new: "bg-sky-400",
  err: "bg-red-400",
};

/**
 * Explorer de projetos × branches (placeholder READ-ONLY — Fase C fica fora).
 * Árvore visual, sem persistência/navegação nesta versão.
 */
export function ExplorerTree({ groups }: { groups: ExplorerGroup[] }) {
  return (
    <div className="flex h-full flex-col overflow-auto border-l border-edge p-2">
      {groups.map((group) => (
        <div key={group.name}>
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-zinc-200">
            <group.icon size={14} aria-hidden />
            {group.name}
          </div>
          <div className="flex flex-col gap-0.5 pb-2 pl-4">
            {group.branches.map((branch) => (
              <div
                key={branch.name}
                data-status={branch.status}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs text-zinc-500"
              >
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[branch.status])} />
                <span className="truncate font-mono">{branch.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
