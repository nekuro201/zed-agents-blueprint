import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatThreadView } from "./ChatThreadView";

const base = {
  mock: false,
  onProjectDirChange: () => {},
  onMockChange: () => {},
  onBrowse: () => {},
  onGenerate: () => {},
};

describe("ChatThreadView (F1 — gate de projeto)", () => {
  it("sem projeto mostra gate: pasta, modo simulado e Abrir projeto; composer ausente", () => {
    render(<ChatThreadView projectDir="" {...base} />);
    expect(screen.getByPlaceholderText(/caminho\/para\/o\/projeto/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /modo simulado/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir projeto/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/descreva o escopo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enviar/i })).not.toBeInTheDocument();
  });

  it("com projeto libera o composer e esconde o CTA Abrir projeto", () => {
    render(<ChatThreadView projectDir="/tmp/proj" {...base} />);
    const textarea = screen.getByPlaceholderText(/descreva o escopo/i);
    expect(textarea).toBeEnabled();
    expect(screen.queryByRole("button", { name: /abrir projeto/i })).not.toBeInTheDocument();
  });

  it("clicar em Abrir projeto chama onBrowse", async () => {
    const onBrowse = vi.fn();
    const user = userEvent.setup();
    render(<ChatThreadView projectDir="" {...base} onBrowse={onBrowse} />);
    await user.click(screen.getByRole("button", { name: /abrir projeto/i }));
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });
});

describe("ChatThreadView (F2 — bubbles e planning)", () => {
  it("enviar escopo chama onGenerate e mostra bubble do usuário", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<ChatThreadView projectDir="/tmp/proj" {...base} onGenerate={onGenerate} />);
    await user.type(screen.getByPlaceholderText(/descreva o escopo/i), "Tela de login JWT");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    expect(onGenerate).toHaveBeenCalledWith("Tela de login JWT");
    expect(screen.getByText("Tela de login JWT")).toBeInTheDocument();
  });

  it("enquanto planning, composer fica disabled e mostra feedback do Planejador", () => {
    render(<ChatThreadView projectDir="/tmp/proj" {...base} planning />);
    expect(screen.getByPlaceholderText(/descreva o escopo/i)).toBeDisabled();
    expect(screen.getByText(/planejador gerando/i)).toBeInTheDocument();
  });

  it("com plannerCard em streaming mostra thinking do Planejador como no Loop", () => {
    render(
      <ChatThreadView
        projectDir="/tmp/proj"
        {...base}
        planning
        plannerCard={{
          thinking: "Dividindo o escopo em fases atômicas…",
          text: "",
          model: "llmgateway/deepseek-v4-flash",
          ended: false,
        }}
      />,
    );
    expect(screen.getByTestId("planner-live")).toBeInTheDocument();
    expect(screen.getByText(/dividindo o escopo em fases atômicas/i)).toBeInTheDocument();
    expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
    expect(screen.getByText(/gerando/i)).toBeInTheDocument();
  });

  it("durante planning com card vivo, planner-live existe e preview fica oculto", () => {
    render(
      <ChatThreadView
        projectDir="/tmp/proj"
        {...base}
        planning
        docs={{
          plan: "# PLAN\n\n## [ ] Fase 1 — Setup\n### [ ] 1.1 RED\n",
        }}
        plannerCard={{ thinking: "Vou fatiar…", text: "", model: "llmgateway/deepseek-v4-flash", ended: false }}
      />,
    );
    expect(screen.getByTestId("planner-live")).toBeInTheDocument();
    // Preview do PLAN.md NÃO aparece dentro do card ao vivo (live=true bloqueia o preview)
    expect(screen.queryByText("PLAN.md gerado")).not.toBeInTheDocument();
  });

  it("após plan-done, congela o card do Planejador na conversa (thinking minimizado + resumo + stats + preview PLAN.md)", () => {
    const { rerender, container } = render(
      <ChatThreadView
        projectDir="/tmp/proj"
        {...base}
        planning
        docs={{
          plan: "# PLAN\n\n## [ ] Fase 1 — Setup\n### [ ] 1.1 RED\n",
        }}
        plannerCard={{ thinking: "Vou fatiar…", text: "", model: "llmgateway/deepseek-v4-flash", ended: false }}
      />,
    );
    // Transição: plannerCard.ended muda de false → true (plan-done)
    rerender(
      <ChatThreadView
        projectDir="/tmp/proj"
        {...base}
        planning={false}
        docs={{
          plan: "# PLAN\n\n## [ ] Fase 1 — Setup\n### [ ] 1.1 RED\n",
        }}
        plannerCard={{
          thinking: "Vou fatiar…",
          text: "",
          model: "llmgateway/deepseek-v4-flash",
          ended: true,
          stats: { tokens: { total: 120 }, cost: 0.01 },
        }}
      />,
    );

    // O card ao vivo some (não existe mais)
    expect(screen.queryByTestId("planner-live")).not.toBeInTheDocument();

    // O card congelado aparece na conversa (data-role="planner")
    const frozenCard = container.querySelector('[data-role="planner"]');
    expect(frozenCard).not.toBeNull();
    const card = within(frozenCard as HTMLElement);

    // Resumo (fallback, pois card.text é vazio) + preview do PLAN.md + stats
    expect(card.getByText(/Inicie o loop no orquestrador/i)).toBeInTheDocument();
    expect(card.getByText("Fase 1 — Setup")).toBeInTheDocument();
    expect(card.getByText(/120 tokens/i)).toBeInTheDocument();
  });

  it("segundo envio mantém as duas mensagens do usuário", async () => {
    const user = userEvent.setup();
    render(<ChatThreadView projectDir="/tmp/proj" {...base} />);
    await user.type(screen.getByPlaceholderText(/descreva o escopo/i), "Primeiro escopo");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await user.type(screen.getByPlaceholderText(/descreva o escopo/i), "Ajuste o plano");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    expect(screen.getByText("Primeiro escopo")).toBeInTheDocument();
    expect(screen.getByText("Ajuste o plano")).toBeInTheDocument();
  });
});
