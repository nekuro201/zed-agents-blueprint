import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { runGraphify, generateGraphFor } from "./graph";
import type { EngineEvent } from "./protocol";

/**
 * Mock do `child_process.spawn` para definir o contrato de `runGraphify` sem
 * depender do binário real `graphify` (que pode não estar instalado no ambiente
 * de teste). `vi.mock` é içado (hoisted) pelo Vitest acima dos imports.
 */
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const spawnMock = vi.mocked(spawn);

type FakeChild = EventEmitter & {
  kill: ReturnType<typeof vi.fn>;
  stdout: EventEmitter;
  stderr: EventEmitter;
};

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.kill = vi.fn();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

function asChildProcess(child: FakeChild): ChildProcess {
  return child as unknown as ChildProcess;
}

/** Diretório temporário isolado para simular a saída do `graphify .`. */
async function makeProjectDir(withArtifacts: boolean): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "graph-test-"));
  if (withArtifacts) {
    await fs.mkdir(path.join(dir, "graphify-out"), { recursive: true });
    await fs.writeFile(path.join(dir, "graphify-out", "graph.json"), "{}\n");
    await fs.writeFile(path.join(dir, "graphify-out", "GRAPH_REPORT.md"), "# report\n");
  }
  return dir;
}

afterEach(() => {
  spawnMock.mockReset();
});

describe("runGraphify (contrato)", () => {
  it("binário ausente (spawn lança ENOENT) → not-installed, sem lançar", async () => {
    spawnMock.mockImplementation(() => {
      throw Object.assign(new Error("spawn graphify ENOENT"), { code: "ENOENT" });
    });

    await expect(runGraphify("/tmp/fake-project")).resolves.toEqual({ ok: false, reason: "not-installed" });
  });

  it("binário ausente (evento error ENOENT) → not-installed", async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(asChildProcess(child));

    const promise = runGraphify("/tmp/fake-project");
    child.emit("error", Object.assign(new Error("spawn graphify ENOENT"), { code: "ENOENT" }));

    await expect(promise).resolves.toEqual({ ok: false, reason: "not-installed" });
  });

  it("binário existe e cria graphify-out/{graph.json,GRAPH_REPORT.md} → ok:true com paths", async () => {
    const dir = await makeProjectDir(true);
    try {
      const child = fakeChild();
      spawnMock.mockReturnValue(asChildProcess(child));

      const promise = runGraphify(dir);
      child.emit("close", 0);

      await expect(promise).resolves.toEqual({
        ok: true,
        reportPath: path.join(dir, "graphify-out", "GRAPH_REPORT.md"),
        jsonPath: path.join(dir, "graphify-out", "graph.json"),
      });

      // Invoca o subcomando `update` (AST determinístico, sem chave LLM), que gera
      // graph.json + graph.html + GRAPH_REPORT.md em uma única passada — nunca `graphify .`
      // (o pipeline completo com extração semântica, que exige API key p/ docs/images).
      expect(spawnMock).toHaveBeenCalledWith("graphify", ["update", dir], { cwd: dir });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("processo termina ok mas artefatos ausentes → empty", async () => {
    const dir = await makeProjectDir(false);
    try {
      const child = fakeChild();
      spawnMock.mockReturnValue(asChildProcess(child));

      const promise = runGraphify(dir);
      child.emit("close", 0);

      await expect(promise).resolves.toEqual({ ok: false, reason: "empty" });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("processo excede o timeout → timeout (e mata o processo)", async () => {
    vi.useFakeTimers();
    try {
      const child = fakeChild();
      spawnMock.mockReturnValue(asChildProcess(child));

      const promise = runGraphify("/tmp/fake-project");
      await vi.advanceTimersByTimeAsync(120_001);

      await expect(promise).resolves.toEqual({ ok: false, reason: "timeout" });
      expect(child.kill).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("generateGraphFor (emissão de eventos)", () => {
  it("emite graph-start e depois graph-ready quando o runner retorna ok", async () => {
    const dir = await makeProjectDir(true);
    try {
      const child = fakeChild();
      spawnMock.mockReturnValue(asChildProcess(child));

      const events: EngineEvent[] = [];
      const promise = generateGraphFor((e) => events.push(e), dir);
      child.emit("close", 0);
      await promise;

      expect(events.map((e) => e.type)).toEqual(["graph-start", "graph-ready"]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("emite graph-start e depois graph-error quando o runner falha", async () => {
    spawnMock.mockImplementation(() => {
      throw Object.assign(new Error("spawn graphify ENOENT"), { code: "ENOENT" });
    });

    const events: EngineEvent[] = [];
    await generateGraphFor((e) => events.push(e), "/tmp/fake-project");

    expect(events.map((e) => e.type)).toEqual(["graph-start", "graph-error"]);
  });
});
