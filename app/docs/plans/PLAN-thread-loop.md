# PLAN — Interface "Chat da Thread" + "Loop" v5 (tarefa única)

> Este arquivo serve de **PLAN** (Fases) e **TODO_BATCH** (checkboxes atômicos) para esta tarefa.
> Pode ser executado por outro agente, **uma Fase de cada vez**, com **TDD estrito (RED → GREEN)**
> e **DRY** (ver `AGENTS.md`). Estado: `[x]` feito · `[-]` em andamento · `[ ]` pendente.
> Tags de complexidade: `[⚡ Flash]` (mecânico) · `[🛠️ Pro-Standard]` (regra de negócio comum) · `[🧠 Pro-Complex]`.

---

## Contexto / Estado atual (referência para quem executa)

- Projeto: `app/` (Tauri 2 + React 19 + Tailwind v4 + Zod + **lucide-react** + fonte JetBrainsMono Nerd Font).
- **Já existe e deve ser REUTILIZADO (DRY):**
  - `ChatThreadView` + `ChatThreadPrompt` (composer → dispara `actions.generatePlan(projectDir, prompt)`).
  - Comando `plan` no engine + `generatePlan` no orquestrador (mock grava um `PLAN.md` de exemplo; real roda o skill `planejador`).
  - `useProjectDocs` (lê os 6 docs do projeto) + `DocInspector`/`DocInspectorPane` (só leitura, abas, progresso do PLAN).
  - Reducer com `elapsed`/`tokens`/`cost` (timer enquanto roda) e eventos `agent-start/agent-end/phase`.
  - `LoopTerminal` (terminal), `Sidebar` (Iniciar/Abortar + roster), `Shell` (slots `workspaceView`/`threadView`/`statusBar`), `App` (fonte única de `useEngine` + `projectDir`/`mock`).
- **O que SAIRÁ do Loop:** seletor de pasta (ProjectBar), modo simulado, controles (Iniciar/Pausar/Retomar/Parar) e campo de "injeção de correção" — vão para o gate (F1) e a sidebar (F3).

---

## [x] Fase 0 — Fundamentos (pré-tarefa)
- [x] Infra de testes (Vitest/RTL), engine (comando `plan`), inspector de docs e terminal já existentes.
- [x] Decisões de design já vigentes: sem emojis (lucide-react), inspector somente leitura, campos manuais de modelo.

## [x] Fase 1 — Gate de projeto na "Chat da Thread" [⚡ Flash]
- [x] Estado "projeto definido?": `App` já guarda `projectDir` (localStorage `pi-factory:last-project`); expor para `ChatThreadView` decidir bloqueio.
- [x] Chat da Thread **sem projeto** → tela bloqueada: seletor de pasta (ProjectBar) + modo simulado + CTA "Abrir projeto"; composer e inspector desativados.
- [x] Ao definir a pasta → tela libera (composer ativo; inspector lê os docs desse projeto).
- [x] RED→GREEN: teste do estado bloqueado → liberado (componente/vista ou App).
- [x] Remover do header do Loop: ProjectBar (pasta) e checkbox "Modo simulado" (realocados aqui / settings).

## [x] Fase 2 — Chat da Thread gera e ajusta o PLAN.md [🛠️ Pro-Standard]
- [x] Enviar escopo no composer → `actions.generatePlan(projectDir, prompt)` (já existe) com feedback visual.
- [x] Bubbles de conversa na sessão: mensagem do usuário (escopo) + resposta do Planejador (resumo do que gerou/ajustou).
- [x] **Ajuste iterativo:** nova mensagem = novo `plan` (planejador reescreve/atualiza o `PLAN.md`); manter histórico de bubbles da sessão.
- [x] Inspector da thread **somente leitura** com abas **PLAN / TODO / AGENTS / EPICS / ESCOPO** (igual v5), usando `useProjectDocs` + `DocInspector`; aba PLAN com progresso + fase ativa destacada.
- [x] RED→GREEN por unidade (composer, bubbles, inspector, fluxo de ajuste).
- [x] Fora daqui (Fase C): histórico/contexto multi-turno persistido (não criar agora).

## [x] Fase 3 — Sidebar: "Iniciar Loop" = Start + controles de execução [⚡ Flash]
- [x] Botão "Iniciar Loop" da sidebar vira o **Start** e navega para o Loop:
  - Sem `PLAN.md` no projeto → bloqueado/aviso apontando para o Chat da Thread.
  - Com `PLAN.md` → `actions.start(projectDir, mock)` + trocar view para `workspace`.
- [x] Reposicionar **Pausar / Retomar / Parar** para a seção Orquestrador da sidebar (fora do Loop).
- [x] Campo de **injeção de correção** movido para a sidebar (compacto), funcional pausado ou rodando.
- [x] RED→GREEN: navegação via sidebar + estados dos controles.

## [x] Fase 4 — Loop idêntico ao v5 [🛠️ Pro-Standard]
- [x] **loop-top**: barra de artefatos (`arts`) com:
  - Item **PLAN.md** + **barra de progresso animada** (largura via `planProgress` do plano carregado, com transição — como o `#plan-bar` do exemplo).
  - Chip de **timer** (elapsed) e chip de **tokens/custo** (formatTokens/formatCost) — alimentados pelo reducer.
- [x] **Pipeline visual** dos 4 agentes (Planejador/Techlead/Coder/Juiz TDD) com estados `on/done/idle` **dinâmicos** derivados dos eventos do engine (`phase-start`/`agent-start`/`agent-end`) — substituir o placeholder estático.
- [x] **work** mantido: `LoopTerminal` (terminal à esquerda) + `DocInspectorPane` (PLAN/TODO/LOG à direita).
- [x] Garantir que o cabeçalho antigo do Loop (pasta, mock, botões, inject) **não** apareça mais na view.
- [x] Animações/transições iguais ao exemplo (mudança de agente `.on`, barra de progresso, hover de artefatos).
- [x] RED→GREEN: componente `LoopTop` (arts + pipeline dinâmico + progresso animado) testado.

## [x] Fase 5 — Integração & validação [⚡ Flash]
- [x] Fluxo ponta a ponta (modo simulado): sem projeto → gate → escolher pasta → escrever escopo → Enviar → `PLAN.md` gerado → "Iniciar Loop" na sidebar → navega para o Loop → executa com progresso/pipeline/timer/tokens.
- [x] Suíte TDD verde (RED→GREEN por unidade), `tsc --noEmit`, `vite build`, `pnpm engine:build`.
- [x] Atualizar `ESCOPO.md`/`EPICS.md`/`AGENTS.md` se surgir decisão nova (ex.: home do "modo simulado").

---

## Fora de escopo (Fase C — futuro)
- Histórico de chat persistido / contexto multi-turno real.
- Explorer multi-projeto / multi-branch persistido.
- Edição manual do PLAN.md (inspector continua somente leitura).

## Riscos / decisões em aberto
- **Pipeline dinâmico**: depende do mapeamento `agent-start` (abre agent) e `agent-end` (fecha) para estados — já temos os eventos no reducer.
- **Barra animada**: usar `transition-[width]`/`duration-300` (sem lib extra) — igual ao exemplo.
- **"Modo simulado"**: realocado para o gate/settings; não deve bloquear o demo (manter um lugar visível).
- **Injeção de correção**: mantida funcional (sidebar), apenas fora do Loop, para não regredir o human-in-the-loop.
