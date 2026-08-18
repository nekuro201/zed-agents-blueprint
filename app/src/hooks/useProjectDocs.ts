import { useCallback, useEffect, useState } from "react";
import { readProjectFile } from "../lib/engine";
import type { DocKind } from "../lib/docs";

const DOC_FILES: Record<DocKind, string> = {
  plan: "PLAN.md",
  todo: "TODO_BATCH.md",
  log: "error.log",
  agents: "AGENTS.md",
  epics: "EPICS.md",
  escopo: "ESCOPO.md",
};

export type ProjectDocs = Partial<Record<DocKind, string>>;

/** Lê (somente leitura) os documentos do projeto-alvo para o inspector (2.3). */
export function useProjectDocs(projectDir: string | null): { docs: ProjectDocs; reload: () => void } {
  const [docs, setDocs] = useState<ProjectDocs>({});

  const reload = useCallback(() => {
    if (!projectDir || projectDir.trim() === "") {
      setDocs({});
      return;
    }
    void (async () => {
      const entries = await Promise.all(
        (Object.entries(DOC_FILES) as [DocKind, string][]).map(async ([kind, file]) => {
          const content = await readProjectFile(projectDir, file);
          return [kind, content] as const;
        }),
      );
      const next: ProjectDocs = {};
      for (const [kind, content] of entries) {
        if (content !== null) next[kind] = content;
      }
      setDocs(next);
    })();
  }, [projectDir]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { docs, reload };
}
