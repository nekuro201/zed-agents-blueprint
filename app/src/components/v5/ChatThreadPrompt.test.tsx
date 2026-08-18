import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatThreadPrompt } from "./ChatThreadPrompt";

describe("ChatThreadPrompt (composer do Planejador)", () => {
  it("renderiza textarea e botão desabilitado sem texto", () => {
    render(<ChatThreadPrompt onGenerate={() => {}} />);
    expect(screen.getByPlaceholderText(/descreva o escopo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar/i })).toBeDisabled();
  });

  it("chama onGenerate com o texto e limpa o campo ao enviar", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<ChatThreadPrompt onGenerate={onGenerate} />);
    const textarea = screen.getByPlaceholderText(/descreva o escopo/i);
    await user.type(textarea, "Criar tela de login com JWT");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    expect(onGenerate).toHaveBeenCalledWith("Criar tela de login com JWT");
    expect(textarea).toHaveValue("");
  });

  it("envia com Ctrl+Enter", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<ChatThreadPrompt onGenerate={onGenerate} />);
    await user.type(screen.getByPlaceholderText(/descreva o escopo/i), "Feature X");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onGenerate).toHaveBeenCalledWith("Feature X");
  });
});
