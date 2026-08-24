import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoopTop } from "./LoopTop";

describe("LoopTop", () => {
  it("mostra PLAN.md, barra de progresso, timer e tokens/custo", () => {
    const { container } = render(
      <LoopTop planProgress={66} elapsed={75} tokens={8400} cost={1.25} agents={[]} />,
    );
    expect(screen.getByText(/PLAN\.md/)).toBeInTheDocument();
    const bar = container.querySelector("[data-testid='plan-bar']") as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(bar!.style.width).toBe("66%");
    expect(screen.getByText("00:01:15")).toBeInTheDocument();
    expect(screen.getByText(/8\.4k/)).toBeInTheDocument();
  });

  it("Parar disabled se !running; clique chama onStop quando running", async () => {
    const onStop = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <LoopTop planProgress={0} elapsed={0} tokens={0} cost={0} agents={[]} onStop={onStop} running={false} />,
    );
    expect(screen.getByRole("button", { name: /parar/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /pausar/i })).not.toBeInTheDocument();
    rerender(<LoopTop planProgress={0} elapsed={0} tokens={0} cost={0} agents={[]} onStop={onStop} running />);
    await user.click(screen.getByRole("button", { name: /parar/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
