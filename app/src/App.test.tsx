import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App (home v6 — gate sem sessão)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exibe a home e não a rail do Loop", () => {
    render(<App />);
    expect(screen.getByText(/abrir um projeto/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Loop" })).not.toBeInTheDocument();
  });

  it("mostra CTAs da home", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /novo projeto/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir pasta/i })).toBeInTheDocument();
  });
});
