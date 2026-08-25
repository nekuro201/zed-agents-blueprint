import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnginePanel } from "./EnginePanel";
import { initialState, type EngineUiState } from "../hooks/useEngine";

function makeState(overrides: Partial<EngineUiState> = {}): EngineUiState {
  return { ...initialState, ...overrides };
}

describe("EnginePanel (botão Regenerar grafo)", () => {
  it("mostra o botão com projectDir de sessão, mesmo antes do engine conectar", async () => {
    const onRegenerateGraph = vi.fn();
    const user = userEvent.setup();
    render(
      <EnginePanel
        state={makeState({ projectDir: null })}
        notTauri={false}
        docs={{}}
        hasPlan={false}
        planComplete={false}
        projectDir="/tmp/proj"
        onRegenerateGraph={onRegenerateGraph}
      />,
    );

    const button = screen.getByRole("button", { name: /regenerar grafo/i });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(onRegenerateGraph).toHaveBeenCalledTimes(1);
  });

  it("esconde o botão sem projectDir de sessão e sem engine conectado", () => {
    render(
      <EnginePanel
        state={makeState({ projectDir: null })}
        notTauri={false}
        docs={{}}
        hasPlan={false}
        planComplete={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /regenerar grafo/i })).not.toBeInTheDocument();
  });
});
