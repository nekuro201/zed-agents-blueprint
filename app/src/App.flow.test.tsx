import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { RECENTS_KEY } from "./lib/workspaceSession";

describe("App fluxo — home sem auto-open", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("last-project no LS não abre o workspace sozinho", () => {
    localStorage.setItem("pi-factory:last-project", "/tmp/proj");
    render(<App />);
    expect(screen.getByText(/abrir um projeto/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/descreva o escopo/i)).not.toBeInTheDocument();
  });

  it("sem sessão não há Loop nem ProjectBar", () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: "Loop" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/caminho\/para\/o\/projeto/i)).not.toBeInTheDocument();
  });

  it("clicar recente abre o workspace e Projetos fecha de volta", async () => {
    localStorage.setItem(
      RECENTS_KEY,
      JSON.stringify([{ name: "store-front", path: "/tmp/store-front", openedAt: Date.now() }]),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText("store-front"));
    expect(screen.queryByText(/abrir um projeto/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Loop" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /projetos/i }));
    expect(screen.getByText(/abrir um projeto/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Loop" })).not.toBeInTheDocument();
  });
});
