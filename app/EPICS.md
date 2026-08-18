# EPICS.md — Iniciativas Macro do Pi Factory

> Ordem macro das iniciativas (cada Épico pode conter Fases/Sub-fases). Escopo da
> versão atual em [ESCOPO.md](./ESCOPO.md). Regras/arquitetura em [AGENTS.md](./AGENTS.md).
> Controle de estado: `[x]` concluído · `[-]` em andamento · `[ ]` pendente.

---

## [x] E1 — Fundação do app desktop
Fundação técnica do Pi Factory (Tauri + React + Tailwind v4 + Zod + sidecar Node).

### [x] E1.1 App e stack
- [x] Scaffold Tauri v2 + React 19 + TypeScript strict.
- [x] Tailwind CSS v4 via `@tailwindcss/vite`.
- [x] Zod v4 no transporte e nas saídas estruturadas.
- [x] pnpm como único gerenciador (2 lockfiles: app/ e app/engine/).

### [x] E1.2 Engine (recriação do automacao.js via SDK real)
- [x] Wrapper `@earendil-works/pi-coding-agent` (createAgentSession/AgentSession).
- [x] Orquestrador: leitor → techlead → coder → testes → QA judge → marcar fase → commit.
- [x] Protocolo JSON (stdin/stdout) + pause/resume/inject/stop.
- [x] Modo simulado (`--mock`/`PI_ENGINE_MOCK`).

### [x] E1.3 Bridge Rust + UI base
- [x] Bridge `src-tauri` (spawn, eventos, kill no fechamento).
- [x] UI base: StatusBadge, Controls, PhaseProgress, InjectBar, Timeline.

---

## [-] E2 — UI v5 · Núcleo + Fase B (primeira versão funcional)
Converter o protótipo `pi_agent_manager_v5.html` na UI real, com as funções principais
funcionais e o motor ligado. (Escopo detalhado em `ESCOPO.md`.)

### [-] E2.1 Shell e navegação
- [ ] Titlebar, rail, sidebar (roster + iniciar/abortar), statusbar e explorer placeholder.
- [ ] Views (Chat Global • Chat da Thread • Workspace) + command palette (⌘K) + atalhos.
- [ ] Modal de modelos com **campos manuais** (sem dropdown) + persistência local.

### [ ] E2.2 Loop visual
- [ ] Pipeline dos 4 agentes (on/done) ligado a `phase/agent-start/agent-end`.
- [ ] Terminal com cards de thinking em streaming + `.summary` + `.done-cta` + banner de abort.
- [ ] Timer + tokens/custo reais por agente.
- [ ] **Performance (cap/dedupe):** agregação por card, limite de cards/linhas, estado limitado.

### [ ] E2.3 Inspector de documentos
- [ ] Abas PLAN/TODO/LOG (loop) e PLAN/TODO/AGENTS/EPICS/ESCOPO (thread).
- [ ] Leitura real dos arquivos do projeto-alvo + highlight da fase ativa.
- [ ] Barra de progresso do PLAN.md (contagem `[x]`).
- [ ] **Somente leitura** — sem edição manual pela UI.

---

## [ ] E3 — Robustez do loop (próxima)
- Protocolo de crise com auditoria na UI (exibir/inspecionar antes de reverter).
- Retry/backoff e telemetria por agente (custo, tokens, duração).
- Gestão de erro/estado do motor com indicadores claros por etapa.

---

## [ ] E4 — Fase C: chat + multi-thread (futuro)
- Histórico real de conversa por thread (sessões persistentes em JSONL, via SDK).
- Explorer de múltiplos projetos/branches com estados por thread.
- Chat Global com contexto cruzado entre threads.

---

## [ ] E5 — Produção
- Empacotar Node como sidecar do Tauri (`externalBin`) para distribuição.
- Assinatura/notarização e instaladores por plataforma.
- Telemetria/observabilidade (logs, métricas de execução).
