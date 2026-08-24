import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("exibe branch, fase, tokens e versão", () => {
    render(<StatusBar motor="idle" branch="feature/auth-ui" fase="Fase 2.2 · Validação Zod" tokens="8.4k" version="v0.1.0" />);
    expect(screen.getByText("feature/auth-ui")).toBeInTheDocument();
    expect(screen.getByText(/validação zod/i)).toBeInTheDocument();
    expect(screen.getByText("8.4k")).toBeInTheDocument();
    expect(screen.getByText(/pi · v0\.1\.0/i)).toBeInTheDocument();
  });

  it("reflete o estado do motor no data-state", () => {
    const { container } = render(<StatusBar motor="run" branch="main" fase="" tokens="0" version="v0.1.0" />);
    const dot = container.querySelector("[data-state]");
    expect(dot!.getAttribute("data-state")).toBe("run");
  });

  it("sem callbacks não renderiza Explorer nem Configurações", () => {
    render(<StatusBar motor="idle" branch="main" fase="" tokens="0" version="v0.1.0" />);
    expect(screen.queryByRole("button", { name: "Explorer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configurações" })).not.toBeInTheDocument();
  });

  it("renderiza Explorer no rodapé que chama onToggleExplorer e reflete explorerOpen", async () => {
    const onToggleExplorer = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <StatusBar motor="idle" branch="main" fase="" tokens="0" version="v0.1.0" onToggleExplorer={onToggleExplorer} />,
    );
    const explorer = screen.getByRole("button", { name: "Explorer" });
    expect(explorer).toHaveAttribute("aria-pressed", "false");
    await user.click(explorer);
    expect(onToggleExplorer).toHaveBeenCalledTimes(1);

    rerender(
      <StatusBar motor="idle" branch="main" fase="" tokens="0" version="v0.1.0" onToggleExplorer={onToggleExplorer} explorerOpen />,
    );
    expect(screen.getByRole("button", { name: "Explorer" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renderiza Configurações no rodapé que chama onOpenSettings", async () => {
    const onOpenSettings = vi.fn();
    const user = userEvent.setup();
    render(<StatusBar motor="idle" branch="main" fase="" tokens="0" version="v0.1.0" onOpenSettings={onOpenSettings} />);
    await user.click(screen.getByRole("button", { name: "Configurações" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
