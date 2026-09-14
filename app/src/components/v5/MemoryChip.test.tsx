import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryChipView } from "./MemoryChip";
import { MEMORY_ALERT_BYTES, MEMORY_WARN_BYTES } from "../../lib/memory";

const MB = 1024 ** 2;

describe("MemoryChipView (2.2.5 — indicador de memória do rodapé)", () => {
  it("não renderiza nada sem medição", () => {
    const { container } = render(<MemoryChipView mem={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada quando nenhum processo foi medido", () => {
    const { container } = render(<MemoryChipView mem={{ app: null, webview: null, engine: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o total somado e detalha por processo no tooltip", () => {
    render(<MemoryChipView mem={{ app: 64 * MB, webview: 512 * MB, engine: 128 * MB }} />);
    expect(screen.getByText("704 MB")).toBeInTheDocument();
    const chip = screen.getByTitle(/Memória \(RSS\)/);
    expect(chip).toHaveAttribute("title", expect.stringContaining("UI: 512 MB"));
    expect(chip).toHaveAttribute("title", expect.stringContaining("Motor: 128 MB"));
  });

  it("muda o nível (cor) conforme o total cruza os limiares", () => {
    const { container, rerender } = render(<MemoryChipView mem={{ app: null, webview: MB, engine: MB }} />);
    expect(container.querySelector("[data-memory]")).toHaveAttribute("data-memory", "ok");

    rerender(<MemoryChipView mem={{ app: null, webview: MEMORY_WARN_BYTES, engine: 0 }} />);
    expect(container.querySelector("[data-memory]")).toHaveAttribute("data-memory", "warn");

    rerender(<MemoryChipView mem={{ app: null, webview: MEMORY_ALERT_BYTES, engine: 0 }} />);
    expect(container.querySelector("[data-memory]")).toHaveAttribute("data-memory", "alert");
  });
});
