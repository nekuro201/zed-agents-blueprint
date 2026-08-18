import { describe, it, expect } from "vitest";
import { parseDoc, planProgress } from "./docs";

const PLAN = `# PLAN

## [x] Fase 1 — Setup
### [x] 1.1 Scaffold
## [-] Fase 2 — Auth
### [ ] 2.1 Validação
`;

describe("docs — parser de markdown (2.3)", () => {
  it("parseia headings do PLAN com mark/cls/indent", () => {
    const rows = parseDoc(PLAN, "plan");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ mark: "[x]", cls: "done", indent: 2 });
    expect(rows[2]).toMatchObject({ mark: "[-]", cls: "now" });
    expect(rows[3]).toMatchObject({ mark: "[ ]", cls: "todo", indent: 3 });
  });

  it("calcula progresso a partir das rows (total/done/pct)", () => {
    const p = planProgress(parseDoc(PLAN, "plan"));
    expect(p.total).toBe(4);
    expect(p.done).toBe(2);
    expect(p.pct).toBe(50);
  });

  it("parseia checkboxes do TODO_BATCH", () => {
    const rows = parseDoc("- [ ] Criar x\n- [x] Criar y\n", "todo");
    expect(rows.map((r) => r.mark)).toEqual(["[ ]", "[x]"]);
  });

  it("epics mistura headings marcados e bullets simples", () => {
    const rows = parseDoc("## [x] E1 feito\n- item simples\n## [ ] E2", "epics");
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.mark)).toEqual(["[x]", null, "[ ]"]);
  });

  it("logs viram linhas sem mark", () => {
    const rows = parseDoc("erro linha 1\nerro linha 2", "log");
    expect(rows.map((r) => r.text)).toEqual(["erro linha 1", "erro linha 2"]);
    expect(rows[0]!.mark).toBeNull();
  });
});
