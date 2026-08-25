import { describe, it, expect, vi, afterEach } from "vitest";
import { runMock } from "./mock";
import { createGate } from "./orchestrator";
import type { EngineEvent } from "./protocol";

/**
 * Testa os GATILHOS do grafo em `runMock` (open do workspace + fim de cada fase).
 * Substituímos `generateGraphFor` por um spy que simula o comportamento observável
 * (emite `graph-start`/`graph-ready`), assim verificamos apenas ONDE o runMock o
 * invoca — sem depender do binário real `graphify` nem do fs.
 */
vi.mock("./graph.js", () => ({
  generateGraphFor: vi.fn(async (emit: (e: EngineEvent) => void, projectDir: string) => {
    emit({ type: "graph-start", projectDir });
    emit({ type: "graph-ready", projectDir });
  }),
  runGraphify: vi.fn(),
}));

import { generateGraphFor } from "./graph.js";

const generateGraphForMock = vi.mocked(generateGraphFor);

function capture(): { events: EngineEvent[]; emit: (e: EngineEvent) => void } {
  const events: EngineEvent[] = [];
  return { events, emit: (e: EngineEvent) => void events.push(e) };
}

function indexOf(events: EngineEvent[], type: string, from = 0): number {
  for (let i = from; i < events.length; i++) {
    if (events[i]?.type === type) return i;
  }
  return -1;
}

afterEach(() => {
  vi.useRealTimers();
  generateGraphForMock.mockReset();
});

describe("runMock (gatilhos do grafo)", () => {
  it("invoca generateGraphFor no open e após a primeira fase commitada", async () => {
    vi.useFakeTimers();
    const { events, emit } = capture();

    const gate = createGate();
    const promise = runMock({ projectDir: "/tmp/fake-project", emit, gate });

    await vi.runAllTimersAsync();
    await promise;

    const firstGraphStart = indexOf(events, "graph-start");
    const firstPhaseStart = indexOf(events, "phase-start");
    const firstCommit = indexOf(events, "commit");

    // open do workspace: primeira geração dispara ANTES da primeira fase.
    expect(firstGraphStart).toBeGreaterThanOrEqual(0);
    expect(firstGraphStart).toBeLessThan(firstPhaseStart);

    // fim de fase: nova geração após o primeiro commit.
    expect(indexOf(events, "graph-start", firstCommit + 1)).toBeGreaterThanOrEqual(0);

    // open + 3 fases = 4 invocações; e cada uma emitiu o graph-ready correspondente.
    expect(generateGraphForMock).toHaveBeenCalledTimes(4);
    expect(events.filter((e) => e.type === "graph-ready").length).toBeGreaterThanOrEqual(2);
  });
});
