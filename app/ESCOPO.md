# ESCOPO.md — Primeira Versão Funcional (Núcleo + Fase B)

> Fonte da verdade de escopo para a implementação da UI v5 do Pi Factory.
> Ordem macro das iniciativas em [EPICS.md](./EPICS.md). Regras/arquitetura em [AGENTS.md](./AGENTS.md).

## Objetivo

Transformar a tela do protótipo [`app/prototype/pi_agent_manager_v5.html`](./prototype/pi_agent_manager_v5.html)
na interface real do app (Tauri + React + Tailwind v4), com as **funções principais funcionais**
e o **motor real** (Engine sidecar Node) ligado de ponta a ponta.

## Escopo In (nesta versão)

### UI/UX (derivado do protótipo v7 — ver `PLAN-fix-uiux.md`)
- **Shell completo:** titlebar, rail, statusbar e explorer em árvore de threads — **sem a
  sidebar esquerda** (o loop/roster virou o modal "Orquestrador").
- **Views:** Chat da Thread (assistente), Chat Global (contexto cruzado) e Workspace/Loop.
- **Rail:** Chat Global · Chat da Thread · Grafo (E3) · Loop · Explorer (toggle) · Settings.
- **Explorer de threads:** árvore com seleção de thread ativa, estados por branch
  (`ok`/`run`/`new`/`err`) e legenda. Sem persistência multi-projeto nesta versão (UI only).
- **Modal Orquestrador:** Iniciar Loop (disabled sem PLAN/PLAN completo), Abortar Loop,
  roster dos 4 agentes (modelo/thinking) e acesso ao modal de modelos.
- **Modal de Histórico / Nova sessão (só UI):** lista de sessões por branch + ação
  "Nova sessão (limpa contexto)". Persistência real fica para a Fase C (E5).
- **Pipeline visual** dos 4 agentes (Planejador, Techlead, Coder, Juiz TDD) com estados `on`/`done`.
- **Terminal do loop** com cards de thinking colapsáveis em streaming, resumos (`.summary`),
  painel de conclusão (`.done-cta`) e banner de abort.
- **Inspector de documentos:** abas PLAN/TODO/LOG (no loop) e PLAN/TODO/AGENTS/EPICS/ESCOPO
  (na thread). **Somente leitura**, com highlight da fase ativa e barra de progresso do PLAN.
- **Statusbar:** dot do motor, branch ativa, fase atual, custo/tokens da thread, thinking
  por agente e versão.
- **Command palette** (⌘K), atalhos de teclado (⌘1/2/3 · ⌘B · ⌘,) e modal de modelos.
- **Modal de modelos:** campos **manuais** (texto) para "modelo" e "opção de thinking" de cada
  agente, persistidos localmente.
- **Responsivo:** explorer vira drawer < 1180px e colapsa < 860px.

### Motor (Engine real)
- Loop completo: leitor → techlead → coder → testes (`pnpm`) → QA judge (Zod) →
  marcação determinística da fase → commit (protocolo de crise se estourar 3 tentativas).
- Eventos em streaming exibidos na timeline/terminal: `token/thinking/tool-call/tool-result/
  test/qa-verdict/phase/agent-start/agent-end/commit/crisis`.
- **Abortar loop** (`stop`) com abort da sessão do agente.
- **Timer** e **tokens/custo reais por agente** (via `session.getSessionStats()`).
- Modo `--mock` mantido para validar a UI sem credenciais.

## Escopo Out — Fase C (evolução futura, fora desta versão)

> **Nota:** a **superfície de UI** de parte destes itens (chat global, histórico/sessões e
> explorer de threads) já é entregue como UI-only pelo [`PLAN-fix-uiux.md`](./PLAN-fix-uiux.md)
> (Épico E9). O que permanece em Fase C é a **persistência real** e o **contexto multi-turno**.

- Chat global/thread com **histórico real** de conversa (mensagens persistentes).
- **Explorer multi-projeto / multi-branch** com árvore de threads e estados persistidos.
- Interação de **edição manual do PLAN.md** pela UI (o inspector é somente leitura).
- **Laboratório (protótipo v5, bloqueado):**
  - **QA Tester E2E** — testes end-to-end com "Vision via browser" (validar o app rodando, não só testes unitários).
  - **UX/UI Prototyper** — geração de "Artefatos visuais" (mockups/preview de UI) a partir do escopo.

## Decisões Firmadas (riscos de tempo resolvidos)

1. **Inspector de docs = somente leitura.** Quem marca fase/status é o **engine**
   (edição determinística local), nunca a UI. Sem `markPlan`/`activatePlan` interativos.
2. **Modelos = campos manuais**, sem dropdown do registry. Valores padrão podem vir do engine.
3. **Performance = cap/dedupe.** A UI não pode ficar lenta em loops longos:
   agregar `token/thinking` por card de agente; limitar nº de cards e linhas do terminal
   (descartar os mais antigos); estado nunca cresce sem limite.
4. **Home v6 é o gate do app.** Boot sem sessão (não auto-abre last-project).
   Sem pasta: só a home. Workspace = UI v5. Modo simulado/real e vars não-secretas
   ficam nas settings da home. Explorer reflete o path aberto + branches git
   (sem git: thread `(default)`). Um workspace ativo por vez.
   Sidebar da thread: só Iniciar Loop (disabled sem PLAN) + settings de modelos.
   Loop: só Parar. Enter no composer envia. Chat persistido / pause-inject = fora.

---

## Nova Mecânica — Grafo de Conhecimento (Graphify)

Mapear o projeto-alvo em um **grafo de arquitetura** (open-source, on-device, sem
telemetria — `graphifyy`) e injetar nos agents. Motivação: o Coder consome ~70% de
todos os tokens (a maioria em `grep`/`read` para navegar o código); um grafo compacto
corta essa navegação e dá contexto arquitetural real ao Techlead/Planejador.

### Escopo In (desta mecânica)

- **Geração do grafo:** `graphify .` no **open do workspace** e no **fim de cada fase**
  do loop → `GRAPH_REPORT.md` + `graph.json` na raiz do projeto-alvo. Botão
  "Regenerar grafo" na UI.
- **Viewer do grafo (graph2):** entrada **"Grafo"** no rail + toolbar (Ver grafo / Atualizar /
  Simular alterações / Nova aba / Gerar) e badge de estado (`sem grafo` / `gerando` /
  `atualizado` / `desatualizado`) com banner de staleness. Visual embutido em iframe.
- **Injeção nos agents:** em `engine/src/skills.ts` (`buildSkillPrompt`), injetar o
  `GRAPH_REPORT.md` junto com o `AGENTS.md` (resumo de god nodes, módulos/comunidades
  e conexões — **nunca** o `graph.json` inteiro).
- **`graphify query` para o Coder/Testador:** quando o grafo existe, agentes podem
  consultar o mapa por caminhos reais (via `bash` do SDK) em vez de grep.
- **Detector de staleness:** comparar mtime do `graph.json` vs. a fonte mais nova →
  chip "Grafo desatualizado" na UI + aviso no prompt ("confirme com `read` antes de editar").
- **Degradação graciosa:** sem o `graphifyy` instalado, o app roda exatamente como hoje.

### Decisões firmadas (não reabrir)

1. **O grafo é auxílio de navegação, nunca fonte da verdade** — os arquivos reais
   (`read`/`bash`) continuam soberanos; a skill manda confirmar antes de editar.
2. **Regenerar no fim da fase** (código commitado) mantém o grafo fresco para a fase
   seguinte; repos gigantes usam intervalo configurável (fallback manual).
3. **Injetar só o `GRAPH_REPORT.md`** (resumo compacto) — o `graph.json` inteiro nunca
   entra no prompt.

### Critérios de aceite

1. Com `graphifyy` instalado: o open do workspace gera o grafo e os agents navegam com `graphify query`.
2. Sem `graphifyy`: fluxo atual 100% idêntico (zero regressão).
3. Código alterado fora do loop → chip "Grafo desatualizado" aparece **sem rodar parse** (só mtime).
4. `pnpm test`, `tsc --noEmit` e `vite build` verdes.

## Critérios de Aceite (primeira versão funcional)

1. `pnpm tauri dev` abre a tela v5.
2. Iniciar loop real em um projeto com `PLAN.md` → pipeline, thinking streaming, inspector
   e statusbar refletem o andamento real.
3. Abortar o loop a qualquer momento → sessão abortada e UI consistente.
4. Inspector de docs mostra `PLAN.md`/`TODO_BATCH.md`/`error.log` reais (somente leitura).
5. Modal de modelos aceita valores manuais e os persiste.
6. Em execução longa, a UI permanece fluida (cap/dedupe ativo).

## Não-objetivos

- Não implementa Fase C nesta versão.
- Não introduz arquitetura complexa (o app segue deliberadamente simples — ver `AGENTS.md`).
- Não monitora múltiplos projetos em paralelo.
