import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./CommandPalette";
import type { PaletteCommand } from "../../lib/commands";

function makeCmds(): PaletteCommand[] {
  return [
    { id: "chat-global", label: "Chat Global", keys: "⌘1", run: vi.fn() },
    { id: "chat-thread", label: "Chat da Thread", keys: "⌘2", run: vi.fn() },
  ];
}

describe("CommandPalette", () => {
  it("não renderiza nada quando fechada", () => {
    const { container } = render(<CommandPalette open={false} commands={makeCmds()} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lista os comandos quando aberta", () => {
    render(<CommandPalette open commands={makeCmds()} onClose={() => {}} />);
    expect(screen.getByRole("option", { name: /chat global/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /chat da thread/i })).toBeInTheDocument();
  });

  it("filtra comandos pelo texto digitado", async () => {
    const user = userEvent.setup();
    render(<CommandPalette open commands={makeCmds()} onClose={() => {}} />);
    await user.type(screen.getByPlaceholderText(/buscar comando/i), "thread");
    expect(screen.queryByRole("option", { name: /chat global/i })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /chat da thread/i })).toBeInTheDocument();
  });

  it("executa run() e fecha ao clicar num comando", async () => {
    const cmds = makeCmds();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CommandPalette open commands={cmds} onClose={onClose} />);
    await user.click(screen.getByRole("option", { name: /chat global/i }));
    expect(cmds[0]!.run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Enter executa o comando destacado", async () => {
    const cmds = makeCmds();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CommandPalette open commands={cmds} onClose={onClose} />);
    await user.type(screen.getByPlaceholderText(/buscar comando/i), "{Enter}");
    expect(cmds[0]!.run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("mostra 'Nenhum comando' quando o filtro não encontra nada", async () => {
    const user = userEvent.setup();
    render(<CommandPalette open commands={makeCmds()} onClose={() => {}} />);
    await user.type(screen.getByPlaceholderText(/buscar comando/i), "zzz");
    expect(screen.getByText(/nenhum comando/i)).toBeInTheDocument();
  });

  it("Escape chama onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CommandPalette open commands={makeCmds()} onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
