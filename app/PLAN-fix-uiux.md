# Plano de Execução — Correções de UI/UX (v7 + graph2)

> **Épico:** E9 (EPICS.md) · Escopo em ESCOPO.md · Regras em AGENTS.md
> **Criado em:** 2026-08-24
> **Complexidade Geral:** [🛠️ Pro-Standard]
> **Protótipos:** `prototype/pi_agent_manager_v7.html` (redesign da UI) e `prototype/pi_graph2.html` (viewer do grafo)
> **Estado:** `[x]` feito · `[-]` em andamento · `[ ]` pendente
> **TDD/DRY:** estrito (RED → GREEN), `pnpm test` / `tsc --noEmit` / `vite build`.

---

## Contexto / Decisões (não reabrir)

- **Alvo:** levar a UI atual (v5/v6) ao design do protótipo **v7** sem regressão
  funcional. O **motor (engine) não muda** nesta iniciativa — é só superfície.
- **Shell v7 = `rail + main + explorer`** — a sidebar esquerda (roster + Iniciar Loop)
  **sai**; loop/roster viram o **modal "Orquestrador"**.
- **Explorer vira árvore de threads** com estados (`ok`/`run`/`new`/`err`) + seleção +
  legenda. Sem persistência multi-projeto (UI only).
- **Histórico / Nova sessão = só a UI.** A persistência real de sessões é **E5 (Fase C)**,
  fora desta iniciativa. Usar seed estática para validar o visual.
- **Entrada "Grafo" no rail é do E3** (não desta iniciativa) — apenas garantir o espaço
  visual no rail.
- Sem emojis (lucide-react). DRY: reutilizar componentes já existentes (abaixo).
- Responsivo: explorer vira **drawer overlay < 1180px** e colapsa < 860px.

### Já existe e deve ser REUTILIZADO (DRY)

- `Shell` (slots `workspaceView`/`threadView`/`statusBar`), `ViewRail`, `TitleBar`, `StatusBar`.
- `ThreadInspector` (5 abas PLAN/TODO/AGENTS/EPICS/ESCOPO — **já ok**, não mexer).
- `DocInspectorPane` (PLAN/TODO/LOG no loop) + `DocTabs`/`DocInspector` (só leitura).
- `LoopTop`/`Pipeline`, `CommandPalette`, `ModelSettingsModal`, `ChatThreadPrompt`.
- `ExplorerTree` (já tem `BranchStatus` = `ok`/`run`/`new`/`err` e `ExplorerGroup`).
- `views.ts` (`ViewId` = `chat-global` · `chat-thread` · `workspace`).

---

## [ ] Fase 0 — Fundamentos (pré-tarefa) [⚡ Flash]
- [ ] Confirmar base verde: `pnpm test`, `tsc --noEmit`, `vite build`.
- [ ] Confirmar que `ThreadInspector` (5 abas) e `DocInspectorPane` (PLAN/TODO/LOG) já
      atendem ao inspector do v7 — nenhuma mudança necessária neles.

## [ ] Fase 1 — Shell: remover sidebar esquerda → modal Orquestrador [🛠️ Pro-Standard]
- [ ] Mudar o layout do `Shell` para `rail + main + explorer` (remover `Sidebar` da coluna central).
- [ ] Criar `OrchestratorModal` (novo componente): **Iniciar Loop** (disabled sem PLAN ou
      PLAN completo), **Abortar Loop**, roster dos 4 agentes (modelo/thinking) e botão
      "Configurar modelos" → abre `ModelSettingsModal`.
- [ ] Botão **"Orquestrador"** no `LoopTop` (ao lado do timer/tokens) abre o modal.
- [ ] Mover `onStart`/`startDisabled`/`planComplete` do `Sidebar` para o modal (e/ou `App`).
- [ ] Rail v7: manter as 3 views + botões **Explorer** (toggle) e **Settings**; o botão
      **Grafo** entra junto com o E3.
- [ ] Remover/desativar `Sidebar.tsx` (ou reaproveitá-lo como base do modal).
- [ ] RED→GREEN: shell renderiza sem sidebar; modal abre/fecha; Iniciar Loop respeita
      `hasPlan`/`planComplete`.

## [ ] Fase 2 — Explorer de threads [🛠️ Pro-Standard]
- [ ] Evoluir `ExplorerTree` para árvore com **seleção de thread ativa** (`selectThread`).
- [ ] Estados por branch (`ok`/`run`/`new`/`err`) + **legenda** ("Status da thread").
- [ ] `markAsSeen` para branches `unread`/`alert` (limpa o indicador ao clicar).
- [ ] Manter estrutura multi-projeto via `ExplorerGroup` (UI only, sem persistência).
- [ ] RED→GREEN: seleção muda `data-active`; legenda renderiza; `markAsSeen` limpa o indicador.

## [ ] Fase 3 — Chat Global real [⚡ Flash]
- [ ] Substituir o placeholder de `chat-global` por view real: view-bar (chip "Visão total"
      + botão **Histórico**), estado vazio ilustrado e composer
      ("Pergunte sobre qualquer thread deste projeto…").
- [ ] Reutilizar `ChatThreadPrompt`/composer (sem lógica de envio real — UI only).
- [ ] RED→GREEN: view renderiza view-bar + empty state + composer.

## [ ] Fase 4 — Modal de Histórico / Nova sessão (UI only) [🛠️ Pro-Standard]
- [ ] Criar `HistoryModal`: lista de sessões por branch + ação **"Nova sessão (limpa contexto)"**.
- [ ] Botão **"Histórico"** (⌥H) na chat-thread e chat-global abre o modal (título contextual thread/global).
- [ ] Lista com seed estática (igual ao protótipo) — persistência real é E5.
- [ ] RED→GREEN: modal abre/fecha; lista renderiza; "Nova sessão" emite callback (no-op por ora).

## [ ] Fase 5 — StatusBar "thinking por agente" [⚡ Flash]
- [ ] Adicionar campo "thinking por agente" na `StatusBar` (derivado do estado do loop).
- [ ] RED→GREEN: nova prop renderiza/oculta conforme estado.

## [ ] Fase 6 — Responsividade [⚡ Flash]
- [ ] Explorer vira **drawer overlay < 1180px** (absoluto + sombra), recolhível.
- [ ] < 860px: reduzir paddings do chat e esconder o label "Global" do chip de tokens.
- [ ] RED→GREEN: comportamento do drawer testado (classe responsiva / toggle).

## [ ] Fase 7 — Integração & validação [⚡ Flash]
- [ ] Fluxo ponta a ponta (mock): home → workspace → chat thread → orquestrador (modal)
      → loop → explorer seleciona branch.
- [ ] `pnpm test`, `tsc --noEmit`, `vite build`.
- [ ] Atualizar `ESCOPO.md`/`EPICS.md`/`AGENTS.md` se surgir decisão nova.

---

## Fora de escopo

- **Persistência real** de sessões/histórico (E5 — Fase C).
- **Backend do grafo** (E3) — a entrada "Grafo" no rail é E3, não esta iniciativa.
- **Edição manual do PLAN.md** (inspector segue somente leitura).
- Pause/resume/inject (human-in-the-loop) — não fazem parte das correções do v7.

## Riscos / decisões em aberto

- **Remover `Sidebar`** pode quebrar referências em `Shell.tsx`/`App.tsx` e nos testes
  `Shell.test.tsx`/`Sidebar.test.tsx` — atualizar testes na mesma entrega.
- **`hasPlan`/`planComplete` no modal Orquestrador**: hoje vêm do `App` via `Shell`; mover
  para o modal pode exigir prop drilling — manter a fonte no `App` para evitar duplicação.
- **Histórico sem persistência**: usar seed estática (como o protótipo) para validar o
  visual; o contrato do modal deve prever a troca futura por dados reais (E5).
- **Explorer sem persistência**: a seleção de thread é visual; a troca real de branch já
  existe via `createGitBranch` — não duplicar.

---

## Resumo de Estimativas

| Fase | Complexidade | Estimativa |
|------|-------------|------------|
| Fase 0 | ⚡ Flash | 15 min |
| Fase 1 | 🛠️ Pro-Standard | 2h 30min |
| Fase 2 | 🛠️ Pro-Standard | 1h 30min |
| Fase 3 | ⚡ Flash | 30 min |
| Fase 4 | 🛠️ Pro-Standard | 1h |
| Fase 5 | ⚡ Flash | 20 min |
| Fase 6 | ⚡ Flash | 30 min |
| Fase 7 | ⚡ Flash | 45 min |
| **Total** | | **~7h 20min** |

Primeira Fase no Techlead: **Fase 1** (`[🛠️ Pro-Standard]`).
