import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatThreadView } from "./ChatThreadView";
import type { ChatMessage } from "../../lib/conversations";

const base = {
  mock: false,
  onProjectDirChange: () => {},
  onMockChange: () => {},
  onBrowse: () => {},
  onSend: () => {},
  onOpenHistory: () => {},
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

describe("ChatThreadView (F2 — controlado pela conversa ativa)", () => {
  it("enviar escopo chama onSend", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatThreadView projectDir="/tmp/proj" {...base} onSend={onSend} />);
    await user.type(screen.getByPlaceholderText(/descreva o escopo/i), "Tela de login JWT");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    expect(onSend).toHaveBeenCalledWith("Tela de login JWT");
  });

  it("renderiza as mensagens da conversa ativa (prop)", () => {
    const messages: ChatMessage[] = [
      { id: "m1", role: "user", text: "Primeiro escopo" },
      { id: "m2", role: "planner", thinking: "Vou fatiar…", text: "", model: "llmgateway/deepseek-v4-flash" },
    ];
    render(<ChatThreadView projectDir="/tmp/proj" {...base} messages={messages} />);
    expect(screen.getByText("Primeiro escopo")).toBeInTheDocument();
    const planner = screen.getByText(/Vou fatiar/i);
    expect(planner).toBeInTheDocument();
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
        docs={{ plan: "# PLAN\n\n## [ ] Fase 1 — Setup\n### [ ] 1.1 RED\n" }}
        plannerCard={{ thinking: "Vou fatiar…", text: "", model: "llmgateway/deepseek-v4-flash", ended: false }}
      />,
    );
    expect(screen.getByTestId("planner-live")).toBeInTheDocument();
    expect(screen.queryByText("PLAN.md gerado")).not.toBeInTheDocument();
  });

  it("renderiza o card do Planejador congelado vindo da conversa (messages prop)", () => {
    const messages: ChatMessage[] = [
      {
        id: "m1",
        role: "planner",
        thinking: "Vou fatiar…",
        text: "",
        model: "llmgateway/deepseek-v4-flash",
        stats: { tokens: { total: 120 }, cost: 0.01 },
      },
    ];
    const { container } = render(
      <ChatThreadView
        projectDir="/tmp/proj"
        {...base}
        messages={messages}
        docs={{ plan: "# PLAN\n\n## [ ] Fase 1 — Setup\n### [ ] 1.1 RED\n" }}
      />,
    );

    const frozenCard = container.querySelector('[data-role="planner"]');
    expect(frozenCard).not.toBeNull();
    const card = within(frozenCard as HTMLElement);
    expect(card.getByText(/Inicie o loop no orquestrador/i)).toBeInTheDocument();
    expect(card.getByText("Fase 1 — Setup")).toBeInTheDocument();
    expect(card.getByText(/120 tokens/i)).toBeInTheDocument();
  });

  it("renderiza múltiplas mensagens do usuário vindo da conversa (prop)", () => {
    const messages: ChatMessage[] = [
      { id: "m1", role: "user", text: "Primeiro escopo" },
      { id: "m2", role: "user", text: "Ajuste o plano" },
    ];
    render(<ChatThreadView projectDir="/tmp/proj" {...base} messages={messages} />);
    expect(screen.getByText("Primeiro escopo")).toBeInTheDocument();
    expect(screen.getByText("Ajuste o plano")).toBeInTheDocument();
  });
});
