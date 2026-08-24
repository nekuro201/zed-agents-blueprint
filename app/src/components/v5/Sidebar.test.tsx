import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Brain, ClipboardList } from "lucide-react";
import { Sidebar, type SidebarAgent } from "./Sidebar";

const agents: SidebarAgent[] = [
  { id: "plan", label: "Planejador", icon: Brain, model: "deepseek-v4-flash", thinking: "Standard" },
  { id: "lead", label: "Techlead", icon: ClipboardList, model: "grok-4-5", thinking: "Standard" },
];

const defaults = {
  agents,
  hasPlan: true,
  onStart: () => {},
  activeLabel: "x",
};

describe("Sidebar", () => {
  it("mostra o workspace ativo e os agentes do roster", () => {
    render(<Sidebar {...defaults} activeLabel="store-front" />);
    expect(screen.getByText("store-front")).toBeInTheDocument();
    expect(screen.getByText("Planejador")).toBeInTheDocument();
    expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
  });

  it("sem PLAN.md Iniciar Loop fica disabled e não chama onStart", async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<Sidebar {...defaults} hasPlan={false} onStart={onStart} />);
    const start = screen.getByRole("button", { name: /iniciar loop/i });
    expect(start).toBeDisabled();
    await user.click(start);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("com PLAN concluído (planComplete) Iniciar Loop fica disabled e avisa", () => {
    const onStart = vi.fn();
    render(<Sidebar {...defaults} hasPlan planComplete={true} onStart={onStart} />);
    const start = screen.getByRole("button", { name: /iniciar loop/i });
    expect(start).toBeDisabled();
    expect(screen.getByText(/PLAN\.md concluído/i)).toBeInTheDocument();
  });

  it("com PLAN.md chama onStart ao clicar em Iniciar Loop", async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<Sidebar {...defaults} hasPlan onStart={onStart} />);
    await user.click(screen.getByRole("button", { name: /iniciar loop/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("não mostra Pausar, Retomar, Parar nem Injetar", () => {
    render(<Sidebar {...defaults} />);
    expect(screen.queryByRole("button", { name: /pausar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retomar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /parar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /injetar/i })).not.toBeInTheDocument();
  });

  it("tem botão de configuração da thread", () => {
    render(<Sidebar {...defaults} onOpenSettings={() => {}} />);
    expect(screen.getByRole("button", { name: /configurar thread/i })).toBeInTheDocument();
  });
});
