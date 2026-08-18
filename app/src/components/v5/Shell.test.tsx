import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Shell } from "./Shell";

describe("Shell (2.1.1 — orquestração de navegação)", () => {
  it("inicia na Chat da Thread", () => {
    render(<Shell />);
    expect(screen.getByText(/assistente da thread/i)).toBeInTheDocument();
  });

  it("troca para o Loop ao clicar na rail", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(screen.getByRole("button", { name: "Loop" }));
    expect(screen.getByText(/loop do orquestrador/i)).toBeInTheDocument();
  });

  it("abre a palette com ⌘K e navega escolhendo 'Chat Global'", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("option", { name: /chat global/i })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /chat global/i }));
    expect(screen.getByText(/escopo geral do projeto/i)).toBeInTheDocument();
  });

  it("troca de view com o atalho ⌘3 (workspace)", () => {
    render(<Shell />);
    fireEvent.keyDown(window, { key: "3", metaKey: true });
    expect(screen.getByText(/loop do orquestrador/i)).toBeInTheDocument();
  });

  it("mostra titlebar, statusbar e explorer junto do shell", () => {
    render(<Shell />);
    expect(screen.getByText(/pi factory/i)).toBeInTheDocument();
    expect(screen.getByText(/pi · v0\.1\.0/i)).toBeInTheDocument();
    expect(screen.getByText(/frontend e-commerce/i)).toBeInTheDocument();
  });
});
