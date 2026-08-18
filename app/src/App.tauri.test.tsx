import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

// Simula o ambiente Tauri (declarado ANTES do render — o hook lê isTauri() no mount).
beforeEach(() => {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
});

describe("App em ambiente Tauri (bugfix: Iniciar liberado)", () => {
  it("não mostra o aviso 'fora do Tauri' e habilita Iniciar no Loop", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Loop" }));
    expect(screen.queryByText(/fora do tauri/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Iniciar$/ })).toBeEnabled();
  });
});
