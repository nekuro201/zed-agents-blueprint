import type { ProjectDocs } from "../../hooks/useProjectDocs";
import { DocTabs, type DocTab } from "./DocTabs";

const THREAD_TABS: readonly DocTab[] = [
  { key: "plan", label: "PLAN", progress: true },
  { key: "todo", label: "TODO", progress: false },
  { key: "agents", label: "AGENTS", progress: false },
  { key: "epics", label: "EPICS", progress: false },
  { key: "escopo", label: "ESCOPO", progress: false },
];

/** Inspector da Chat da Thread (v5): PLAN/TODO/AGENTS/EPICS/ESCOPO, só leitura. */
export function ThreadInspector({ docs }: { docs: ProjectDocs }) {
  return <DocTabs tabs={THREAD_TABS} docs={docs} />;
}
