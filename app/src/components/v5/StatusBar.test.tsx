import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
