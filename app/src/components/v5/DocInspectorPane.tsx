import type { ProjectDocs } from "../../hooks/useProjectDocs";
import { DocTabs, type DocTab } from "./DocTabs";

const LOOP_TABS: readonly DocTab[] = [
  { key: "plan", label: "PLAN", progress: true },
  { key: "todo", label: "TODO", progress: false },
  { key: "log", label: "LOG", progress: false },
];

/** Painel lateral do Loop: inspector de docs (somente leitura) com abas. */
export function DocInspectorPane({ docs }: { docs: ProjectDocs }) {
  return <DocTabs tabs={LOOP_TABS} docs={docs} />;
}
