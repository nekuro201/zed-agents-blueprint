# PLAN.md — Pi Factory (app/)

> Controle de progresso da implementação (uma fase por vez). Macro em
> [EPICS.md](./EPICS.md) · Escopo em [ESCOPO.md](./ESCOPO.md) · Regras em [AGENTS.md](./AGENTS.md).
> Estado: `[x]` concluído · `[-]` em andamento · `[ ]` pendente.
> Método: **TDD estrito** (RED → GREEN) e **DRY** — ver `AGENTS.md`.

---

## [x] Fase 1 — Fundação do app (engine + bridge)
### [x] 1.1 App Tauri 2 + React 19 + Tailwind v4 + Zod (pnpm only)
### [x] 1.2 Engine sidecar Node (SDK real `@earendil-works/pi-coding-agent` + orquestrador + protocolo JSON + mock)
### [x] 1.3 Bridge Rust + UI base (timeline/controls/progress/inject)

---

## [x] Fase 2 — UI v5 · Núcleo + Fase B (primeira versão funcional)
### [x] 2.0 Infra de testes (Vitest + React Testing Library + `pnpm test`)
### [x] 2.1 Shell e navegação
### [x] 2.1.1 Titlebar / rail / sidebar (roster) / statusbar / explorer placeholder
### [x] 2.1.4 App monta o Shell v5 (painel do engine no view Loop — sem regressão)
### [x] 2.1.2 Views (Chat Global • Chat da Thread • Workspace)
### [x] 2.1.2.1 Estado de view (useActiveView) + ViewRail (unidade testada)
### [x] 2.1.2.2 Command palette (⌘K) com filtro/navegação
### [x] 2.1.2.3 Atalhos de teclado (⌘1/2/3, ⌘K, Esc)
### [x] 2.1.3 Modal de modelos (campos manuais, sem dropdown) + persistência local (Zod/localStorage)
### [x] 2.2.1 Pipeline dos 4 agentes (Planejador/Techlead/Coder/Juiz TDD) com on/done
### [x] 2.2.2 Terminal + cards de thinking streaming (+ blocos teste/QA/commit/crise)
### [x] 2.2.3 Timer + tokens/custo reais (reducer + statusbar real pelo App)
### [x] 2.2.4 Performance (cap/dedupe: janela do terminal + cap de estado no reducer)
### [x] 2.3.1 Inspector de docs SOMENTE leitura no Loop (abas PLAN/TODO/LOG; AGENTS/EPICS/ESCOPO vão junto com a Fase C/thread)
### [x] 2.3.2 Barra de progresso do PLAN + highlight da fase ativa (`[-]`)
### [x] 2.5 Composer do Planejador (vindo do teste manual: prompt → PLAN.md; mock grava exemplo, real roda o skill `planejador`)

---

## [ ] Fase 3 — Robustez do loop
- Protocolo de crise com auditoria na UI.
- Retry/backoff e telemetria por agente.

## [ ] Fase 4 — Fase C (futuro)
- Chat com histórico real por thread.
- Explorer multi-projeto/multi-branch (persistido).
- Chat Global com contexto cruzado.

## [ ] Fase 5 — Produção
- Empacotar Node como sidecar `externalBin`.
- Assinatura/instaladores por plataforma.
