import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Brain, ClipboardList, Code2, Scale } from "lucide-react";
import { Pipeline, type PipelineAgent } from "./Pipeline";

const agents: PipelineAgent[] = [
  { id: "plan", label: "Planejador", icon: Brain, model: "deepseek-v4-flash", status: "done" },
  { id: "techlead", label: "Techlead", icon: ClipboardList, model: "deepseek-v4-flash", status: "active" },
  { id: "coder", label: "Coder", icon: Code2, model: "deepseek-v4-flash", status: "idle" },
  { id: "qa", label: "Juiz TDD", icon: Scale, model: "grok-4-5", status: "idle" },
];

describe("Pipeline", () => {
  it("renderiza todos os agentes com label, ícone e modelo", () => {
    render(<Pipeline agents={agents} />);
    for (const a of agents) {
      expect(screen.getByText(a.label)).toBeInTheDocument();
      // modelos podem se repetir entre agentes (ex.: deepseek-v4-flash em 3) — dupla é legítima
      expect(screen.getAllByText(a.model).length).toBeGreaterThan(0);
    }
  });

  it("expõe o status de cada agente (done/active/idle) via data-status", () => {
    const { container } = render(<Pipeline agents={agents} />);
    const statuses = [...container.querySelectorAll("[data-status]")].map((el) => el.getAttribute("data-status"));
    expect(statuses).toEqual(["done", "active", "idle", "idle"]);
  });

  it("marca visualmente o agente ativo", () => {
    const { container } = render(<Pipeline agents={agents} />);
    const active = container.querySelector('[data-status="active"]');
    expect(active).not.toBeNull();
    expect(active!.className).toContain("opacity-100");
  });
});
