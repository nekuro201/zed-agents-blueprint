import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, ClipboardList, Code2, FlaskConical, Scale, TriangleAlert } from "lucide-react";
import type { TimelineItem } from "../hooks/useEngine";
import type { AgentRole } from "./protocol";
import { ROLE_LABEL } from "./roles";
import type { PipelineAgent } from "../components/v5/Pipeline";

/**
 * Pipeline visual do loop — derivado 1:1 do `AgentRole` (fonte única), sem
 * colapsar papéis. O Planejador (`planejador`) fica de fora: roda apenas na
 * geração do PLAN.md (antes do loop), não na esteira de fases.
 */
const PIPELINE_ROLES: readonly AgentRole[] = ["leitor", "techlead", "coder", "testador", "qa", "crise"];

const ROLE_ICON: Record<AgentRole, LucideIcon> = {
  planejador: BookOpenCheck,
  leitor: BookOpenCheck,
  techlead: ClipboardList,
  coder: Code2,
  testador: FlaskConical,
  qa: Scale,
  crise: TriangleAlert,
};

/** Modelo padrão exibido no card (mesmo default do engine, para o estado vazio). */
const DEFAULT_MODEL = "llmgateway/deepseek-v4-flash";

function shortModel(model: string): string {
  const slash = model.lastIndexOf("/");
  return slash >= 0 ? model.slice(slash + 1) : model;
}

export function pipelineFromTimeline(timeline: TimelineItem[]): PipelineAgent[] {
  const lastByRole = new Map<AgentRole, { ended: boolean; model?: string }>();
  for (const item of timeline) {
    if (item.kind !== "agent") continue;
    lastByRole.set(item.role, { ended: item.ended, model: item.model });
  }

  const activeRole = PIPELINE_ROLES.find((role) => {
    const last = lastByRole.get(role);
    return last !== undefined && !last.ended;
  });
  const activeIndex = activeRole ? PIPELINE_ROLES.indexOf(activeRole) : -1;

  return PIPELINE_ROLES.map((role, i) => {
    const last = lastByRole.get(role);
    let status: PipelineAgent["status"] = "idle";
    if (role === activeRole) status = "active";
    else if (last?.ended || (activeIndex >= 0 && i < activeIndex)) status = "done";
    return {
      id: role,
      label: ROLE_LABEL[role],
      icon: ROLE_ICON[role],
      model: shortModel(last?.model ?? DEFAULT_MODEL),
      status,
    };
  });
}
