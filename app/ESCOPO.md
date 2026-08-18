# ESCOPO.md — Primeira Versão Funcional (Núcleo + Fase B)

> Fonte da verdade de escopo para a implementação da UI v5 do Pi Factory.
> Ordem macro das iniciativas em [EPICS.md](./EPICS.md). Regras/arquitetura em [AGENTS.md](./AGENTS.md).

## Objetivo

Transformar a tela do protótipo [`app/prototype/pi_agent_manager_v5.html`](./prototype/pi_agent_manager_v5.html)
na interface real do app (Tauri + React + Tailwind v4), com as **funções principais funcionais**
e o **motor real** (Engine sidecar Node) ligado de ponta a ponta.

## Escopo In (nesta versão)

### UI/UX (derivado do protótipo v5)
- **Shell completo:** titlebar, rail, sidebar (roster + iniciar/abortar loop), statusbar e
  explorer (placeholder com a thread ativa — sem persistência multi-projeto).
- **Views:** Chat da Thread (placeholders visuais), Chat Global (placeholder), Workspace/Loop (funcional).
- **Pipeline visual** dos 4 agentes (Planejador, Techlead, Coder, Juiz TDD) com estados `on`/`done`.
- **Terminal do loop** com cards de thinking colapsáveis em streaming, resumos (`.summary`),
  painel de conclusão (`.done-cta`) e banner de abort.
- **Inspector de documentos:** abas PLAN/TODO/LOG (no loop) e PLAN/TODO/AGENTS/EPICS/ESCOPO
  (na thread). **Somente leitura**, com highlight da fase ativa e barra de progresso do PLAN.
- **Statusbar:** dot do motor, branch ativa, fase atual, custo/tokens da thread e versão.
- **Command palette** (⌘K), atalhos de teclado (⌘1/2/3 · ⌘B · ⌘,) e modal de modelos.
- **Modal de modelos:** campos **manuais** (texto) para "modelo" e "opção de thinking" de cada
  agente, persistidos localmente.

### Motor (Engine real)
- Loop completo: leitor → techlead → coder → testes (`pnpm`) → QA judge (Zod) →
  marcação determinística da fase → commit (protocolo de crise se estourar 3 tentativas).
- Eventos em streaming exibidos na timeline/terminal: `token/thinking/tool-call/tool-result/
  test/qa-verdict/phase/agent-start/agent-end/commit/crisis`.
- **Abortar loop** (`stop`) com abort da sessão do agente.
- **Timer** e **tokens/custo reais por agente** (via `session.getSessionStats()`).
- Modo `--mock` mantido para validar a UI sem credenciais.

## Escopo Out — Fase C (evolução futura, fora desta versão)

- Chat global/thread com **histórico real** de conversa (mensagens persistentes).
- **Explorer multi-projeto / multi-branch** com árvore de threads e estados persistidos.
- Interação de **edição manual do PLAN.md** pela UI (o inspector é somente leitura).

## Decisões Firmadas (riscos de tempo resolvidos)

1. **Inspector de docs = somente leitura.** Quem marca fase/status é o **engine**
   (edição determinística local), nunca a UI. Sem `markPlan`/`activatePlan` interativos.
2. **Modelos = campos manuais**, sem dropdown do registry. Valores padrão podem vir do engine.
3. **Performance = cap/dedupe.** A UI não pode ficar lenta em loops longos:
   agregar `token/thinking` por card de agente; limitar nº de cards e linhas do terminal
   (descartar os mais antigos); estado nunca cresce sem limite.

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
