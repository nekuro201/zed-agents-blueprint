import { useState } from "react";
import { cn } from "../../lib/cn";
import { parseDoc, type DocKind } from "../../lib/docs";
import { useProjectDocs } from "../../hooks/useProjectDocs";
import { DocInspector } from "./DocInspector";

type TabKey = DocKind & ("plan" | "todo" | "log");

const TABS: { key: TabKey; label: string; progress: boolean }[] = [
  { key: "plan", label: "PLAN", progress: true },
  { key: "todo", label: "TODO", progress: false },
  { key: "log", label: "LOG", progress: false },
];

/** Painel lateral do Loop: inspector de docs (somente leitura) com abas. */
export function DocInspectorPane({ projectDir }: { projectDir: string }) {
  const { docs } = useProjectDocs(projectDir);
  const [active, setActive] = useState<TabKey>("plan");
  const activeTab = TABS.find((tab) => tab.key === active)!;
  const content = docs[activeTab.key] ?? "";

  return (
    <div className="flex min-h-0 min-w-0 flex-col border-l border-edge bg-[#0f1116]">
      <div className="flex border-b border-edge">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "flex-1 border-b-2 px-2 py-1.5 text-[11px] font-semibold transition-colors",
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
