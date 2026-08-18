import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseDoc } from "../../lib/docs";
import { DocInspector } from "./DocInspector";

const PLAN = `# PLAN
## [x] Fase 1 — Setup
## [-] Fase 2 — Auth (ativa)
### [ ] 2.1 Validação
`;

describe("DocInspector (2.3 — docs somente leitura)", () => {
  it("renderiza rows com mark e destaca a linha em andamento (now)", () => {
    render(<DocInspector title="PLAN.md" rows={parseDoc(PLAN, "plan")} />);
    expect(screen.getByText(/fase 1 — setup/i)).toBeInTheDocument();
    const now = screen.getByText(/fase 2 — auth \(ativa\)/i);
    expect(now.closest("[data-cls]")?.getAttribute("data-cls")).toBe("now");
  });

  it("mostra a barra de progresso quando showProgress", () => {
    render(<DocInspector title="PLAN.md" rows={parseDoc(PLAN, "plan")} showProgress />);
    // PLAN do teste: 3 fases marcadas, 1 concluída → 33%
    expect(screen.getByText(/33%/)).toBeInTheDocument();
  });

  it("mostra fallback quando não há rows", () => {
    render(<DocInspector title="LOG" rows={[]} />);
    expect(screen.getByText(/aguardando conteúdo/i)).toBeInTheDocument();
  });
});
