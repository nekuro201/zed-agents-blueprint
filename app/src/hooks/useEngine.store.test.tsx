import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  resetEngineStore,
  dispatchEngineEvent,
  dispatch,
  useEngineSelector,
  useEngineState,
  usePlannerCard,
} from "./useEngine";

/**
 * Store externo (2.2.4 — isolamento de streaming): com useSyncExternalStore,
 * cada consumidor assina só o pedaço que usa. Estes testes garantem que views
 * inativas NÃO re-renderizam a cada flush de streaming durante um loop.
 */

describe("useEngineSelector — re-render seletivo", () => {
  beforeEach(() => {
    resetEngineStore();
  });

  it("só re-renderiza o componente cujo valor selecionado mudou", () => {
    const counts = { elapsed: 0, status: 0 };
    function ElapsedProbe() {
      counts.elapsed++;
      const elapsed = useEngineSelector((s) => s.elapsed);
      return <div data-testid="elapsed">{elapsed}</div>;
    }
    function StatusProbe() {
      counts.status++;
      const status = useEngineSelector((s) => s.status);
      return <div data-testid="status">{status}</div>;
    }

    render(
      <>
        <ElapsedProbe />
        <StatusProbe />
      </>,
    );
    expect(counts.elapsed).toBe(1);
    expect(counts.status).toBe(1);

    // status idle → running: só o probe de status re-renderiza.
    act(() => dispatchEngineEvent({ type: "status", status: "running" }));
    expect(counts.elapsed).toBe(1);
    expect(counts.status).toBe(2);

    // tick (elapsed 0→1): só o probe de elapsed re-renderiza.
    act(() => dispatch({ type: "tick" }));
    expect(counts.elapsed).toBe(2);
    expect(counts.status).toBe(2);
  });

  it("useEngineState re-renderiza a cada mudança (painel do loop)", () => {
    let renders = 0;
    function FullProbe() {
      renders++;
      useEngineState();
      return null;
    }
    render(<FullProbe />);
    expect(renders).toBe(1);
    // O tick só muda o estado enquanto o loop roda (status running).
    act(() => dispatchEngineEvent({ type: "status", status: "running" }));
    expect(renders).toBe(2);
    act(() => dispatch({ type: "tick" }));
    expect(renders).toBe(3);
    // Debug logs que não mudam nada NÃO notificam (early-return do dispatch).
    act(() => dispatchEngineEvent({ type: "log", level: "debug", message: "[bash] x" }));
    expect(renders).toBe(3);
  });

  it("resetEngineStore volta para o estado inicial", () => {
    function StatusProbe() {
      const status = useEngineSelector((s) => s.status);
      return <div data-testid="status">{status}</div>;
    }
    render(<StatusProbe />);
    expect(screen.getByText("offline")).toBeInTheDocument();
    act(() => dispatchEngineEvent({ type: "status", status: "running" }));
    expect(screen.getByText("running")).toBeInTheDocument();
    act(() => resetEngineStore());
    expect(screen.getByText("offline")).toBeInTheDocument();
  });
});

describe("usePlannerCard — estável durante streaming de outros agentes", () => {
  beforeEach(() => {
    resetEngineStore();
  });

  it("não re-renderiza durante streaming do coder; re-renderiza no do Planejador", () => {
    let renders = 0;
    let last: ReturnType<typeof usePlannerCard> = null;
    function PlannerProbe() {
      renders++;
      last = usePlannerCard();
      return null;
    }
    render(<PlannerProbe />);
    expect(renders).toBe(1);
    expect(last).toBeNull();

    // Streaming do coder (agent-start + tokens) não muda o card do Planejador.
    act(() => dispatchEngineEvent({ type: "agent-start", role: "coder", model: "m" }));
    act(() => dispatchEngineEvent({ type: "token", role: "coder", delta: "abc" }));
    expect(renders).toBe(1);
    expect(last).toBeNull();

    // Planejador abre → card muda → re-renderiza.
    act(() => dispatchEngineEvent({ type: "agent-start", role: "planejador", model: "m" }));
    expect(renders).toBe(2);
    expect(last).toMatchObject({ ended: false });

    // Streaming do próprio planejador continua re-renderizando (live).
    act(() => dispatchEngineEvent({ type: "token", role: "planejador", delta: "d" }));
    expect(renders).toBe(3);
    expect(last).toMatchObject({ text: "d" });
  });
});
