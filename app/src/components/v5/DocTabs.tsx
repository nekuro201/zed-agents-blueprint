import { useState } from "react";
import { cn } from "../../lib/cn";
import { parseDoc, type DocKind } from "../../lib/docs";
import type { ProjectDocs } from "../../hooks/useProjectDocs";
import { DocInspector } from "./DocInspector";

export interface DocTab {
  key: DocKind;
  label: string;
  progress: boolean;
}

export function DocTabs({
  tabs,
  docs,
}: {
  tabs: readonly DocTab[];
  docs: ProjectDocs;
}) {
  const [active, setActive] = useState<DocKind>(tabs[0]!.key);
  const activeTab = tabs.find((tab) => tab.key === active) ?? tabs[0]!;
  const content = docs[activeTab.key] ?? "";

  return (
    <div className="flex min-h-0 min-w-0 flex-col border-l border-edge bg-[#0f1116]">
      <div className="flex flex-wrap border-b border-edge">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "min-w-13 flex-1 border-b-2 px-2 py-1.5 text-[11px] font-semibold transition-colors",
              active === tab.key
                ? "border-amber-400 bg-amber-400/10 text-amber-300"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <DocInspector
          title={`${activeTab.label}.md`}
          rows={parseDoc(content, activeTab.key)}
          showProgress={activeTab.progress}
        />
      </div>
    </div>
  );
}
