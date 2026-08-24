import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Controls } from "./Controls";
import type { EngineUiState } from "../hooks/useEngine";

function state(partial: Partial<EngineUiState>): EngineUiState {
  return {
    tauri: true,
    connected: false,
    mock: false,
    version: null,
    status: "offline",
    running: false,
    completed: false,
    elapsed: 0,
    tokens: { input: 0, output: 0, total: 0 },
    cost: 0,
    projectDir: null,
    phase: null,
    error: null,
    timeline: [],
    planning: false,
    ...partial,
  };
}

const noop = () => {};

describe("Controls (bugfix: Iniciar liberado)", () => {
  it("habilita Iniciar quando há caminho e não está rodando (Tauri)", async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(
      <Controls state={state({ tauri: true, status: "idle" })} onStart={onStart} onPause={noop} onResume={noop} onStop={noop} canStart />,
    );
    const start = screen.getByRole("button", { name: /iniciar/i });
    expect(start).toBeEnabled();
    await user.click(start);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("mantém Iniciar desabilitado fora do Tauri", () => {
    render(
      <Controls state={state({ tauri: false, status: "idle" })} onStart={noop} onPause={noop} onResume={noop} onStop={noop} canStart />,
    );
    expect(screen.getByRole("button", { name: /iniciar/i })).toBeDisabled();
  });

  it("desabilita Iniciar quando canStart é falso (ex.: sem projeto)", () => {
    render(
      <Controls state={state({ tauri: true })} onStart={noop} onPause={noop} onResume={noop} onStop={noop} canStart={false} />,
    );
    expect(screen.getByRole("button", { name: /iniciar/i })).toBeDisabled();
  });

  it("Pausar desabilitado fora do rodando; Retomar habilitado quando waiting", () => {
    render(
      <Controls state={state({ tauri: true, status: "waiting", running: true })} onStart={noop} onPause={noop} onResume={noop} onStop={noop} canStart={false} />,
    );
    expect(screen.getByRole("button", { name: /pausar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /retomar/i })).toBeEnabled();
  });
});
