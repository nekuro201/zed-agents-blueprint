import type { TimelineItem } from "../hooks/useEngine";
import type { AgentRole } from "./protocol";
import { AGENT_KEYS, AGENT_META, type AgentKey } from "./agents";
import type { PipelineAgent } from "../components/v5/Pipeline";

const ROLE_TO_KEY: Record<AgentRole, AgentKey> = {
  planejador: "plan",
  leitor: "plan",
  techlead: "techlead",
  coder: "coder",
  testador: "qa",
  qa: "qa",
  crise: "qa",
};

function shortModel(model: string): string {
  const slash = model.lastIndexOf("/");
  return slash >= 0 ? model.slice(slash + 1) : model;
}

export function pipelineFromTimeline(timeline: TimelineItem[]): PipelineAgent[] {
  const lastByKey = new Map<AgentKey, { ended: boolean; model?: string }>();
  for (const item of timeline) {
    if (item.kind !== "agent") continue;
    lastByKey.set(ROLE_TO_KEY[item.role], { ended: item.ended, model: item.model });
  }

  const activeKey = AGENT_KEYS.find((key) => {
    const last = lastByKey.get(key);
    return last !== undefined && !last.ended;
  });
  const activeIndex = activeKey ? AGENT_KEYS.indexOf(activeKey) : -1;

  return AGENT_KEYS.map((key, i) => {
    const meta = AGENT_META[key];
    const last = lastByKey.get(key);
    let status: PipelineAgent["status"] = "idle";
    if (key === activeKey) status = "active";
    else if (last?.ended || (activeIndex >= 0 && i < activeIndex)) status = "done";
    return {
      id: key,
      label: meta.label,
      icon: meta.icon,
      model: shortModel(last?.model ?? meta.defaultModel),
      status,
    };
  });
}
