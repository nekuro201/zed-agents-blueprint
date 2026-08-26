import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelSearchSelect } from "./ModelSearchSelect";

const models = [
  { id: "llmgateway/deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "llmgateway", pricing: { prompt: 0.28, completion: 0.42 } },
  { id: "llmgateway/grok-4-5", name: "Grok 4.5", provider: "llmgateway", pricing: { prompt: 2, completion: 8 } },
  { id: "openai/gpt-5", name: "GPT-5", provider: "openai", pricing: { prompt: 15, completion: 60 } },
];

describe("ModelSearchSelect (Fase 2 — E10)", () => {
  it("renderiza o botão de busca", () => {
    render(<ModelSearchSelect value="" onChange={() => {}} models={models} />);
    expect(screen.getByRole("button", { name: /buscar modelo/i })).toBeInTheDocument();
  });

  it("abre o popover ao clicar e mostra a lista", async () => {
    const user = userEvent.setup();
    render(<ModelSearchSelect value="" onChange={() => {}} models={models} />);
    await user.click(screen.getByRole("button", { name: /buscar modelo/i }));
    expect(screen.getByPlaceholderText(/pesquisar modelos/i)).toBeInTheDocument();
    expect(screen.getByText("DeepSeek V4 Flash")).toBeInTheDocument();
  });

  it("filtra ao digitar no campo de pesquisa", async () => {
    const user = userEvent.setup();
    render(<ModelSearchSelect value="" onChange={() => {}} models={models} />);
    await user.click(screen.getByRole("button", { name: /buscar modelo/i }));
    await user.type(screen.getByPlaceholderText(/pesquisar modelos/i), "gpt");
    expect(screen.getByText("GPT-5")).toBeInTheDocument();
    expect(screen.queryByText("DeepSeek V4 Flash")).not.toBeInTheDocument();
    expect(screen.queryByText("Grok 4.5")).not.toBeInTheDocument();
  });

  it("seleciona um item e chama onChange com o id", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ModelSearchSelect value="" onChange={onChange} models={models} />);
    await user.click(screen.getByRole("button", { name: /buscar modelo/i }));
    await user.click(screen.getByText("DeepSeek V4 Flash"));
    expect(onChange).toHaveBeenCalledWith("llmgateway/deepseek-v4-flash");
  });

  it("fecha o popover ao pressionar Escape", async () => {
    const user = userEvent.setup();
    render(<ModelSearchSelect value="" onChange={() => {}} models={models} />);
    await user.click(screen.getByRole("button", { name: /buscar modelo/i }));
    expect(screen.getByPlaceholderText(/pesquisar modelos/i)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByPlaceholderText(/pesquisar modelos/i)).not.toBeInTheDocument();
  });

  it("mostra estado vazio quando a busca não retorna nada", async () => {
    const user = userEvent.setup();
    render(<ModelSearchSelect value="" onChange={() => {}} models={models} />);
    await user.click(screen.getByRole("button", { name: /buscar modelo/i }));
    await user.type(screen.getByPlaceholderText(/pesquisar modelos/i), "claude");
    expect(screen.getByText(/nenhum modelo encontrado/i)).toBeInTheDocument();
  });

  it("mostra o preço (prompt/completion) quando disponível", async () => {
    const user = userEvent.setup();
    render(<ModelSearchSelect value="" onChange={() => {}} models={models} />);
    await user.click(screen.getByRole("button", { name: /buscar modelo/i }));
    expect(screen.getByText(/0\.28\/0\.42/)).toBeInTheDocument();
  });
});
