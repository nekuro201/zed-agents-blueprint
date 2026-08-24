import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewRail } from "./ViewRail";

describe("ViewRail", () => {
  it("renderiza as 3 views (Chat Global, Chat da Thread, Loop)", () => {
    render(<ViewRail active="chat-thread" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Chat Global" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chat da Thread" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Loop" })).toBeInTheDocument();
  });

  it("marca a view ativa via data-active", () => {
    const { container } = render(<ViewRail active="workspace" onSelect={() => {}} />);
    const activeBtn = container.querySelector('[data-active="true"]');
    expect(activeBtn).not.toBeNull();
    expect(activeBtn!.getAttribute("aria-label")).toBe("Loop");
  });

  it("chama onSelect com o id da view ao clicar", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ViewRail active="chat-thread" onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: "Loop" }));
    expect(onSelect).toHaveBeenCalledWith("workspace");
  });

  it("não renderiza Explorer nem Configurações (moveram para o StatusBar)", () => {
    render(<ViewRail active="chat-thread" onSelect={() => {}} />);
    expect(screen.queryByRole("button", { name: "Explorer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configurações" })).not.toBeInTheDocument();
  });
});
