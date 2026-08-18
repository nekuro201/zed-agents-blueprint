import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Brain, ClipboardList } from "lucide-react";
import { Sidebar, type SidebarAgent } from "./Sidebar";

const agents: SidebarAgent[] = [
  { id: "plan", label: "Planejador", icon: Brain, model: "deepseek-v4-flash", thinking: "Standard" },
  { id: "lead", label: "Techlead", icon: ClipboardList, model: "grok-4-5", thinking: "Standard" },
];

describe("Sidebar", () => {
  it("mostra o workspace ativo e os agentes do roster", () => {
    render(<Sidebar agents={agents} running={false} onStart={() => {}} onAbort={() => {}} activeLabel="feature/auth-ui" />);
    expect(screen.getByText("feature/auth-ui")).toBeInTheDocument();
    expect(screen.getByText("Planejador")).toBeInTheDocument();
    expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
  });

  it("chama onStart ao clicar em Iniciar Loop", async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<Sidebar agents={agents} running={false} onStart={onStart} onAbort={() => {}} activeLabel="x" />);
    await user.click(screen.getByRole("button", { name: /iniciar loop/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("desabilita Abortar quando não está rodando", () => {
    render(<Sidebar agents={agents} running={false} onStart={() => {}} onAbort={() => {}} activeLabel="x" />);
    const abort = screen.getByRole("button", { name: /abortar/i });
    expect(abort).toBeDisabled();
  });

  it("habilita Abortar e chama onAbort quando está rodando", async () => {
    const onAbort = vi.fn();
    const user = userEvent.setup();
    render(<Sidebar agents={agents} running onStart={() => {}} onAbort={onAbort} activeLabel="x" />);
    const abort = screen.getByRole("button", { name: /abortar/i });
    expect(abort).toBeEnabled();
    await user.click(abort);
    expect(onAbort).toHaveBeenCalledTimes(1);
  });
});
