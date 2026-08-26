import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoopTop } from "./LoopTop";

describe("LoopTop", () => {
  it("mostra PLAN.md, barra de progresso, timer e tokens/custo", () => {
    const { container } = render(
      <LoopTop planProgress={66} elapsed={75} tokens={8400} cost={1.25} agents={[]} hasPlan planComplete={false} />,
    );
    expect(screen.getByText(/PLAN\.md/)).toBeInTheDocument();
    const bar = container.querySelector("[data-testid='plan-bar']") as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(bar!.style.width).toBe("66%");
    expect(screen.getByText("00:01:15")).toBeInTheDocument();
    expect(screen.getByText(/8\.4k/)).toBeInTheDocument();
  });

  it("não mostra aviso de preço quando há custo", () => {
    render(<LoopTop planProgress={0} elapsed={0} tokens={8400} cost={1.25} agents={[]} hasPlan planComplete={false} />);
    expect(screen.queryByText(/preço não configurado/i)).not.toBeInTheDocument();
  });

  it("mostra aviso quando há tokens mas custo zerado (preço ausente)", () => {
    render(<LoopTop planProgress={0} elapsed={0} tokens={8400} cost={0} agents={[]} hasPlan planComplete={false} />);
    expect(screen.getByText(/preço não configurado/i)).toBeInTheDocument();
  });

  it("não mostra aviso quando não há tokens nem custo (loop ainda não rodou)", () => {
    render(<LoopTop planProgress={0} elapsed={0} tokens={0} cost={0} agents={[]} hasPlan planComplete={false} />);
    expect(screen.queryByText(/preço não configurado/i)).not.toBeInTheDocument();
  });

  it("Iniciar Loop fica disabled sem PLAN e com PLAN completo", () => {
    const { rerender } = render(
      <LoopTop planProgress={0} elapsed={0} tokens={0} cost={0} agents={[]} hasPlan={false} planComplete={false} />,
    );
    expect(screen.getByRole("button", { name: /iniciar loop/i })).toBeDisabled();

    rerender(<LoopTop planProgress={100} elapsed={0} tokens={0} cost={0} agents={[]} hasPlan planComplete />);
    expect(screen.getByRole("button", { name: /iniciar loop/i })).toBeDisabled();
  });

  it("Iniciar Loop habilitado chama onStart ao clicar", async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(
      <LoopTop planProgress={0} elapsed={0} tokens={0} cost={0} agents={[]} hasPlan planComplete={false} onStart={onStart} />,
    );
    await user.click(screen.getByRole("button", { name: /iniciar loop/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("running mostra Abortar Loop e chama onStop ao clicar", async () => {
    const onStop = vi.fn();
    const user = userEvent.setup();
    render(
      <LoopTop planProgress={0} elapsed={0} tokens={0} cost={0} agents={[]} hasPlan planComplete={false} running onStop={onStop} />,
    );
    await user.click(screen.getByRole("button", { name: /abortar loop/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("aborting mostra Abortando… e não expõe Abortar Loop", () => {
    render(
      <LoopTop planProgress={0} elapsed={0} tokens={0} cost={0} agents={[]} hasPlan planComplete={false} running aborting />,
    );
    expect(screen.getByRole("button", { name: /abortando/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /abortar loop/i })).not.toBeInTheDocument();
  });
});
