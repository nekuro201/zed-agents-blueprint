import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GraphViewer } from "./GraphViewer";
import { readGraphFile, graphStaleness } from "../../lib/engine";

/**
 * Fase 4/5 — viewer do grafo. Mockamos `readGraphFile` e `graphStaleness` (ponte
 * Tauri) para simular a presença/ausência do `graph.html` e o estado de
 * staleness do projeto-alvo, sem depender do Rust.
 */
vi.mock("../../lib/engine", () => ({
  readGraphFile: vi.fn(),
  graphStaleness: vi.fn(),
}));

const readGraphFileMock = vi.mocked(readGraphFile);
const graphStalenessMock = vi.mocked(graphStaleness);

beforeEach(() => {
  readGraphFileMock.mockReset();
  graphStalenessMock.mockReset();
  graphStalenessMock.mockResolvedValue({ stale: false, changedCount: 0 });
});

describe("GraphViewer (Fase 4 — viewer do grafo)", () => {
  it("estado vazio: mostra CTA e esconde o iframe quando não há graph.html", async () => {
    readGraphFileMock.mockResolvedValue(null);
    render(<GraphViewer projectDir="/tmp/proj" graphStatus="empty" onGenerate={vi.fn()} />);

    expect(await screen.findByTestId("graph-empty")).toBeInTheDocument();
    expect(screen.getByTestId("graph-badge")).toHaveTextContent("SEM GRAFO");
    expect(screen.getByRole("button", { name: /gerar grafo/i })).toBeInTheDocument();
    expect(screen.queryByTestId("graph-iframe")).not.toBeInTheDocument();
  });

  it("estado pronto: injeta o graph.html via srcdoc no iframe", async () => {
    readGraphFileMock.mockResolvedValue("<html><body>grafo real</body></html>");
    render(<GraphViewer projectDir="/tmp/proj" graphStatus="ready" onGenerate={vi.fn()} />);

    const iframe = await screen.findByTestId("graph-iframe");
    expect(iframe).toHaveAttribute("srcdoc", "<html><body>grafo real</body></html>");
    expect(screen.getByTestId("graph-badge")).toHaveTextContent("ATUALIZADO");
  });

  it("estado gerando: mostra progresso e desabilita o botão Gerar", async () => {
    readGraphFileMock.mockResolvedValue(null);
    render(<GraphViewer projectDir="/tmp/proj" graphStatus="loading" onGenerate={vi.fn()} />);

    expect(await screen.findByTestId("graph-loading")).toBeInTheDocument();
    expect(screen.getByTestId("graph-badge")).toHaveTextContent("GERANDO");
    expect(screen.getByRole("button", { name: "Gerar" })).toBeDisabled();
  });

  it("Simular alterações marca o grafo como desatualizado (banner + badge)", async () => {
    readGraphFileMock.mockResolvedValue("<html>grafo</html>");
    const user = userEvent.setup();
    render(<GraphViewer projectDir="/tmp/proj" graphStatus="ready" onGenerate={vi.fn()} />);

    await screen.findByTestId("graph-iframe");
    await user.click(screen.getByRole("button", { name: "Simular alterações" }));

    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.getByTestId("graph-badge")).toHaveTextContent("DESATUALIZADO");
  });

  it("detecção real: banner mostra N arquivos quando graphStaleness acusa staleness", async () => {
    readGraphFileMock.mockResolvedValue("<html>grafo</html>");
    graphStalenessMock.mockResolvedValue({ stale: true, changedCount: 3 });
    render(<GraphViewer projectDir="/tmp/proj" graphStatus="ready" onGenerate={vi.fn()} />);

    await screen.findByTestId("graph-iframe");
    expect(await screen.findByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.getByTestId("stale-banner")).toHaveTextContent("3 arquivos mudaram");
    expect(screen.getByTestId("graph-badge")).toHaveTextContent("DESATUALIZADO");
  });

  it("Gerar (CTA vazio) dispara onGenerate", async () => {
    readGraphFileMock.mockResolvedValue(null);
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<GraphViewer projectDir="/tmp/proj" graphStatus="empty" onGenerate={onGenerate} />);

    await screen.findByTestId("graph-empty");
    await user.click(screen.getByRole("button", { name: /gerar grafo/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("toolbar expõe os cinco botões com estado correto no vazio", async () => {
    readGraphFileMock.mockResolvedValue(null);
    render(<GraphViewer projectDir="/tmp/proj" graphStatus="empty" onGenerate={vi.fn()} />);

    await screen.findByTestId("graph-empty");
    expect(screen.getByRole("button", { name: "Ver grafo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Simular alterações" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nova aba" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gerar" })).toBeEnabled();
  });
});
