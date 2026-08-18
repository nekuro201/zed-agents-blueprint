import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("App (2.1.4 — App monta o Shell v5)", () => {
  it("exibe o shell v5 com a marca Pi Factory e a rail", () => {
    render(<App />);
    expect(screen.getByText(/pi factory/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Loop" })).toBeInTheDocument();
  });

  it("inicia na Chat da Thread e navega para o Loop pela rail", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/assistente da thread/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Loop" }));
    // Painel do engine visível no Loop (placeholder do projeto é único)
    expect(screen.getByPlaceholderText(/caminho\/para\/o\/projeto/i)).toBeInTheDocument();
  });

  it("mostra o painel do engine (projeto + controles) dentro do Loop", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Loop" }));
    expect(screen.getByPlaceholderText(/caminho\/para\/o\/projeto/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Iniciar$/ })).toBeInTheDocument();
  });

  it("mostra o aviso 'fora do Tauri' (jsdom) dentro do Loop", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Loop" }));
    expect(screen.getByText(/fora do tauri/i)).toBeInTheDocument();
  });
});
