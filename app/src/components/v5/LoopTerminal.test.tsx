import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoopTerminal, LOOP_TERMINAL_MAX_ITEMS } from "./LoopTerminal";
import type { TimelineItem } from "../../hooks/useEngine";

describe("LoopTerminal (2.2.2 — terminal + thinking streaming)", () => {
  it("mostra o estado vazio quando não há itens", () => {
    render(<LoopTerminal items={[]} />);
    expect(screen.getByText(/inicie o loop/i)).toBeInTheDocument();
  });

  it("renderiza o card do agente com label, modelo, thinking e texto enquanto 'live'", () => {
    const item: TimelineItem = {
      id: 1,
      kind: "agent",
      role: "techlead",
      model: "llmgateway/deepseek-v4-flash",
      ended: false,
      thinking: "Vou fatiar a fase em batchs atômicos…",
      text: "Lendo PLAN.md e localizando a fase ativa.",
      tools: [{ tool: "read", args: "PLAN.md", ok: true, summary: "ok" }],
    };
    render(<LoopTerminal items={[item]} />);
    expect(screen.getByText("Techlead")).toBeInTheDocument();
    expect(screen.getByText("llmgateway/deepseek-v4-flash")).toBeInTheDocument();
    expect(screen.getByText(/vou fatiar/i)).toBeInTheDocument();
    expect(screen.getByText(/lendo plan\.md/i)).toBeInTheDocument();
    expect(screen.getByText("read")).toBeInTheDocument();
  });

  it("fecha o thinking (details sem open) e mostra stats quando o agente termina", () => {
    const item: TimelineItem = {
      id: 2,
      kind: "agent",
      role: "coder",
      model: "m",
      ended: true,
      thinking: "Código escrito.",
      text: "tarefa 1 concluída",
      tools: [],
      stats: { tokens: { input: 10, output: 20, total: 30 }, cost: 0.01 },
    };
    const { container } = render(<LoopTerminal items={[item]} />);
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details!.hasAttribute("open")).toBe(false);
    expect(screen.getByText(/30 tokens/i)).toBeInTheDocument();
  });

  it("renderiza veredito QA, commit e bloco de teste", () => {
    const items: TimelineItem[] = [
      { id: 3, kind: "qa", veredito: "ESPERADO", justificativa: "Falha esperada de TDD." },
      { id: 4, kind: "commit", ok: true, message: "feat: conclui Fase 1" },
      { id: 5, kind: "test", state: "ok", output: "Test Suites: 1 passed\nTests: 4 passed" },
    ];
    render(<LoopTerminal items={items} />);
    expect(screen.getByText(/esperado/i)).toBeInTheDocument();
    expect(screen.getByText(/falha esperada de tdd/i)).toBeInTheDocument();
    expect(screen.getByText(/feat: conclui fase 1/i)).toBeInTheDocument();
    expect(screen.getByText(/test suites: 1 passed/i)).toBeInTheDocument();
  });

  it("aplica o cap de itens (janela dos últimos MAX) — 2.2.4 performance", () => {
    const many: TimelineItem[] = Array.from({ length: LOOP_TERMINAL_MAX_ITEMS + 50 }, (_, i) => ({
      id: i,
      kind: "status" as const,
      message: `linha ${i}`,
    }));
    render(<LoopTerminal items={many} />);
    expect(screen.queryByText("linha 0")).not.toBeInTheDocument();
    expect(screen.getByText(`linha ${LOOP_TERMINAL_MAX_ITEMS + 50 - 1}`)).toBeInTheDocument();
  });
});
