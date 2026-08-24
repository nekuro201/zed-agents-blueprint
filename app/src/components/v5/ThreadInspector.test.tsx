import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreadInspector } from "./ThreadInspector";

const PLAN = `## [x] Fase 1 — Setup
## [-] Fase 2 — Auth
## [ ] Fase 3 — API
`;

describe("ThreadInspector (F2 — abas da thread)", () => {
  it("renderiza as 5 abas PLAN / TODO / AGENTS / EPICS / ESCOPO", () => {
    render(<ThreadInspector docs={{}} />);
    expect(screen.getByRole("button", { name: "PLAN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "TODO" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AGENTS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EPICS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ESCOPO" })).toBeInTheDocument();
  });

  it("aba PLAN ativa por default e mostra progresso dos headings marcados", () => {
    render(<ThreadInspector docs={{ plan: PLAN }} />);
    expect(screen.getByText(/33%/)).toBeInTheDocument();
    expect(screen.getByText(/fase 2 — auth/i)).toBeInTheDocument();
  });

  it("clicar TODO troca o conteúdo", async () => {
    const user = userEvent.setup();
    render(<ThreadInspector docs={{ plan: PLAN, todo: "- [ ] Criar login\n" }} />);
    expect(screen.queryByText(/criar login/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "TODO" }));
    expect(screen.getByText(/criar login/i)).toBeInTheDocument();
  });
});
