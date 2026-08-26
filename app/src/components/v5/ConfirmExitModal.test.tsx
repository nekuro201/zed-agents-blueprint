import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmExitModal } from "./ConfirmExitModal";

describe("ConfirmExitModal", () => {
  it("não renderiza nada quando fechada", () => {
    const { container } = render(<ConfirmExitModal open={false} onCancel={() => {}} onConfirm={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o aviso e aciona onConfirm ao confirmar", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmExitModal open onCancel={() => {}} onConfirm={onConfirm} />);
    expect(screen.getByText(/abortado/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /abortar e sair/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("aciona onCancel ao clicar em Cancelar", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmExitModal open onCancel={onCancel} onConfirm={() => {}} />);
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
