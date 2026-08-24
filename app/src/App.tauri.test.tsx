import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  localStorage.clear();
});

describe("App Tauri — home sem sessão", () => {
  it("não monta o Loop e não mostra aviso fora do Tauri (home)", () => {
    render(<App />);
    expect(screen.getByText(/abrir um projeto/i)).toBeInTheDocument();
    expect(screen.queryByText(/fora do tauri/i)).not.toBeInTheDocument();
  });
});
