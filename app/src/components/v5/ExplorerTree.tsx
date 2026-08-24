import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { FolderPlus, GitBranch, GitBranchPlus, PanelRightClose, X } from "lucide-react";
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

export function ExplorerTree({
  groups,
  visible = true,
  hasGit = true,
  onCloseWorkspace,
  onAddWorkspace,
  onNewThread,
}: {
  groups: ExplorerGroup[];
  visible?: boolean;
  hasGit?: boolean;
  onCloseWorkspace?: () => void;
  onAddWorkspace?: () => void;
  onNewThread?: () => void;
}) {
  const [warn, setWarn] = useState<string | null>(null);

  const requestNewBranch = () => {
    if (!hasGit) {
      setWarn("Configure git no projeto para criar uma branch.");
      return;
    }
    setWarn(null);
    onNewThread?.();
  };

  return (
    <div
      data-hidden={visible ? "false" : "true"}
      className={cn("flex h-full flex-col overflow-auto border-l border-edge p-2", !visible && "hidden")}
    >
      <button
        type="button"
        onClick={onAddWorkspace}
        className="mb-2 inline-flex items-center justify-center gap-1 rounded-md border border-edge px-1.5 py-1 text-[10px] text-zinc-400 hover:text-zinc-100"
      >
        <FolderPlus size={11} aria-hidden /> Adicionar workspace
      </button>
      {groups.map((group) => {
        const branches = group.branches.length > 0 ? group.branches : [{ name: "(default)", status: "new" as const }];
        return (
          <div key={group.name}>
            <div className="flex items-center gap-1 px-1 py-1.5 text-xs font-semibold text-zinc-200">
              <group.icon size={14} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{group.name}</span>
              <button
                type="button"
                aria-label="Nova branch"
                onClick={requestNewBranch}
                className="grid h-6 w-6 place-items-center rounded text-zinc-500 hover:text-amber-300"
              >
                <GitBranchPlus size={13} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Fechar"
                onClick={onCloseWorkspace}
                className="grid h-6 w-6 place-items-center rounded text-zinc-500 hover:text-red-300"
              >
                <X size={13} aria-hidden />
              </button>
            </div>
            <div className="flex flex-col gap-0.5 pb-2 pl-3">
              {branches.map((branch) => (
                <div
                  key={branch.name}
                  data-status={branch.status}
                  className="flex items-center gap-2 rounded px-2 py-1 text-xs text-zinc-500"
                >
                  <GitBranch size={11} className={branch.status === "run" ? "text-amber-400" : "text-zinc-600"} aria-hidden />
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[branch.status])} />
                  <span className="min-w-0 flex-1 truncate font-mono">{branch.name}</span>
                  <button type="button" aria-label={`Selecionar ${branch.name}`} className="grid h-5 w-5 place-items-center text-zinc-600">
                    <GitBranch size={10} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {warn && <p className="px-2 text-[10px] text-amber-400">{warn}</p>}
      <button
        type="button"
        aria-label="Ocultar explorer"
        className="mt-auto inline-flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-600"
      >
        <PanelRightClose size={11} aria-hidden /> ⌘B
      </button>
    </div>
  );
}
