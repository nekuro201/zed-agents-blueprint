import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TitleBar } from "./TitleBar";

describe("TitleBar", () => {
  it("renderiza a marca e o atalho ⌘K", () => {
    render(<TitleBar onOpenPalette={() => {}} />);
    expect(screen.getByText(/pi factory/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /⌘k/i })).toBeInTheDocument();
  });

  it("chama onOpenPalette ao clicar no ⌘K", async () => {
    const onOpenPalette = vi.fn();
    const user = userEvent.setup();
    render(<TitleBar onOpenPalette={onOpenPalette} />);
    await user.click(screen.getByRole("button", { name: /⌘k/i }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  it("exibe o rótulo de tokens global", () => {
    render(<TitleBar onOpenPalette={() => {}} tokensLabel="145.2k" />);
    expect(screen.getByText("145.2k")).toBeInTheDocument();
  });
});
