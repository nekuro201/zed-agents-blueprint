import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryModal } from "./HistoryModal";
import type { Conversation } from "../../lib/conversations";

const conversations: Conversation[] = [
  { id: "c1", label: "Conversa 1", createdAt: Date.now() - 60_000, messages: [] },
  { id: "c2", label: "Conversa 2", createdAt: Date.now() - 3_600_000, messages: [{ id: "m1", role: "user", text: "oi" }] },
];

describe("HistoryModal", () => {
  it("não renderiza nada quando fechada", () => {
    const { container } = render(
      <HistoryModal open={false} conversations={conversations} activeId={null} onActivate={() => {}} onNew={() => {}} onDelete={() => {}} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lista as conversas e marca a ativa", () => {
    render(<HistoryModal open conversations={conversations} activeId="c1" onActivate={() => {}} onNew={() => {}} onDelete={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Conversa 1")).toBeInTheDocument();
    expect(screen.getByText("Conversa 2")).toBeInTheDocument();
    expect(screen.getByText("ativa")).toBeInTheDocument();
  });

  it("aciona onNew ao clicar em Nova sessão", async () => {
    const onNew = vi.fn();
    const user = userEvent.setup();
    render(<HistoryModal open conversations={conversations} activeId={null} onActivate={() => {}} onNew={onNew} onDelete={() => {}} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: /nova sessão/i }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("aciona onActivate ao clicar numa conversa", async () => {
    const onActivate = vi.fn();
    const user = userEvent.setup();
    render(<HistoryModal open conversations={conversations} activeId={null} onActivate={onActivate} onNew={() => {}} onDelete={() => {}} onClose={() => {}} />);
    await user.click(screen.getByText("Conversa 2"));
    expect(onActivate).toHaveBeenCalledWith("c2");
  });

  it("aciona onDelete ao clicar no botão excluir", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<HistoryModal open conversations={conversations} activeId={null} onActivate={() => {}} onNew={() => {}} onDelete={onDelete} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: /excluir conversa 2/i }));
    expect(onDelete).toHaveBeenCalledWith("c2");
  });
});
