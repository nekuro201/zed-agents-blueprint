# EPICS.md — Iniciativas Macro do Pi Factory

> Ordem macro das iniciativas (cada Épico pode conter Fases/Sub-fases). Escopo da
> versão atual em [ESCOPO.md](./ESCOPO.md). Regras/arquitetura em [AGENTS.md](./AGENTS.md).
> Histórico de PLANs executados em [`docs/plans/`](./docs/plans/).
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

## [x] E2 — UI v5 · Núcleo + Fase B (primeira versão funcional)
Converter o protótipo `pi_agent_manager_v5.html` na UI real, com as funções principais
funcionais e o motor ligado. (Escopo detalhado em `ESCOPO.md`.)

### [x] E2.1 Shell e navegação
- [x] Titlebar, rail, sidebar (roster + iniciar/abortar), statusbar e explorer placeholder.
- [x] Views (Chat Global • Chat da Thread • Workspace) + command palette (⌘K) + atalhos.
- [x] Modal de modelos com **campos manuais** (sem dropdown) + persistência local.

### [x] E2.2 Loop visual
- [x] Pipeline dos 4 agentes (on/done) ligado a `phase/agent-start/agent-end`.
- [x] Terminal com cards de thinking em streaming + `.summary` + `.done-cta` + banner de abort.
- [x] Timer + tokens/custo reais por agente.
- [x] **Performance (cap/dedupe):** agregação por card, limite de cards/linhas, estado limitado.

### [x] E2.3 Inspector de documentos
- [x] Abas PLAN/TODO/LOG (loop) e PLAN/TODO/AGENTS/EPICS/ESCOPO (thread).
- [x] Leitura real dos arquivos do projeto-alvo + highlight da fase ativa.
- [x] Barra de progresso do PLAN.md (contagem `[x]`).
- [x] **Somente leitura** — sem edição manual pela UI.

---

## [x] E2.4 Home v6 + explorer do path
- [x] App inicia na home (sem auto-open).
- [x] Settings: modo simulado/real + modelo padrão + comando de teste (sem API key).
- [x] Explorer = projeto aberto + branches git; toggle ⌘B; nova thread = branch; fechar volta à home.

---

## [x] E3 — Grafo de Conhecimento (Graphify)
Mapear o projeto-alvo em grafo de arquitetura (open-source, on-device, sem telemetria) e
injetar nos agents — reduzir o grep/tokens do Coder (~70% do consumo) e dar contexto
arquitetural real ao Techlead/Planejador. (Detalhe no ESCOPO.md.)

### [x] E3.1 Geração do grafo
- [x] Gerar `graphify update <projectDir>` no **open do workspace** e no **fim de cada fase** (degradação graciosa se o binário `graphify` não estiver instalado).
- [x] `graphify-out/GRAPH_REPORT.md` + `graphify-out/graph.json`; botão "Regenerar grafo" na UI.

### [x] E3.2 Injeção nos agents
- [x] `buildSkillPrompt` injeta o `GRAPH_REPORT.md` junto com `AGENTS.md` (resumo: god nodes, comunidades, conexões — nunca o `graph.json` inteiro).
- [x] Regra nas skills do Coder/Testador: usar `graphify query` quando o grafo existir e **confirmar com `read`** antes de editar.

### [x] E3.3 Detector de staleness
- [x] Comparar mtime do `graph.json` vs. fonte mais nova → chip "Grafo desatualizado" na UI + aviso no prompt.
- [x] Sem Graphify instalado → o app roda exatamente como hoje.

### [x] E3.4 Viewer do grafo (graph2)
- [x] Entrada **"Grafo"** no rail + atalhos (⌘G gerar · ⌘V ver).
- [x] Toolbar (Ver grafo / Atualizar / Simular alterações / Nova aba / Gerar) + badge de estado
      (`sem grafo` / `gerando` / `atualizado` / `desatualizado`) e banner de staleness.
- [x] Visual embutido em iframe (conteúdo via `read_graph_file` — ver `PLAN-grafo.md` E3 Fase 4).

---

## [x] E4 — Robustez do loop
- Protocolo de crise com auditoria na UI (exibir/inspecionar antes de reverter).
- Retry/backoff e telemetria por agente (custo, tokens, duração).
- Gestão de erro/estado do motor com indicadores claros por etapa.

---

## [x] E10 — Seletor de Modelos com Preço (drop-down + busca)
Adicionar seletor com busca (drop-down pesquisável) que consulta a API do llmgateway,
lista modelos disponíveis com preços reais e os aplica nos campos manuais de configuração.
Calcular custo em memória no engine (sem mexer no `models.json` do CLI `pi`).
Sync de modelos/preço no boot do app. (Plano: `PLAN-selector.md`.)

### [x] E10.1 Comando `models-list` no engine
- [x] Protocolo `models-list` / `models-list-result` (Zod espelhado).
- [x] Fetch da API pública do llmgateway (`GET /v1/models`) com cache em memória.
- [x] Degradação graciosa (timeout/rede/parse → `ok: false`).

### [x] E10.2 Seletor com busca na UI
- [x] Hook `useModelList` + componente `ModelSearchSelect` (campo de texto com drop-down pesquisável).
- [x] Integrar no modal de modelos (cada linha ganha o seletor junto do campo de texto livre).
- [x] Sync da lista de modelos no boot do app.

### [x] E10.3 Cálculo de custo em memória no engine
- [x] Helper `calculateCostFromPricing` ($/milhão de tokens a partir do pricing da API).
- [x] Cache de pricing por modelo no engine.
- [x] Emitir custo real no `agent-end` (sobrescrever `getSessionStats().cost` quando pricing disponível).

---

## [ ] E5 — Fase C: chat + multi-thread (futuro)
- Histórico real de conversa por thread (sessões persistentes em JSONL, via SDK).
- Explorer de múltiplos projetos/branches com estados por thread.
- Chat Global com contexto cruzado entre threads.

---

## [ ] E6 — Produção
- Assinatura/notarização por plataforma.
- Telemetria/observabilidade (logs, métricas de execução).
- Congelar API pública do protocolo (semântica de versão).

---

## [ ] E7 — Instalador compacto e automático (usuário final)
Entregar o app como um único instalador com o mínimo de passos manuais. Meta: instalar →
conectar conta → modelos pré-preenchidos → rodar. (Converge com E6 para o empacotamento.)

### [ ] E7.1 Runtime auto-contido
- [ ] Embutir **Node como sidecar** (`externalBin`) — usuário não instala/pesquisa Node no PATH.
- [ ] Embutir o bundle do engine (`engine/dist/index.mjs`) + SDK `@earendil-works/pi-coding-agent` no instalador.
- [ ] Instaladores por plataforma (.deb/.rpm/AppImage · .dmg · .msi/.exe).

### [ ] E7.2 Skills embutidas e instalação automática
- [ ] Embutir as 4 skills (**planejador, techlead, coder, testador**) no pacote do app.
- [ ] `resolveSkill` no engine resolve **automaticamente** do diretório embutido (ex.: `PI_SKILLS_DIR` apontado pelo app) — usuário não copia skill à mão.
- [ ] Preservar precedência: `.agents/skills/<projeto>` (via `install.sh`) continua valendo quando existir — overrides do usuário.

### [ ] E7.3 Onboarding de credencial e modelos
- [ ] Detectar ausência de `~/.pi/agent` → tela de conexão guiada (comando `pi login` / DevPass) com validação ao concluir.
- [ ] Preencher os modelos a partir do `models.json` (dropdown/recomendação) — reduzir digitação manual.
- [ ] Detectar e instalar o **Graphify** (E3) de forma guiada quando a feature estiver ativa (opcional, nunca bloqueia o fluxo).

### [ ] E7.4 Verificação de fumaça no 1º boot
- [ ] Self-check: Node embutido ok, skills resolvidas, auth presente, fallbacks claros com mensagens acionáveis.

---

## [ ] E8 — Laboratório (features bloqueadas do protótipo v5)
Funções "Laboratório" que aparecem bloqueadas na sidebar do protótipo v5 e que podem ser
implementadas por cima da arquitetura atual.

### [ ] E8.1 QA Tester E2E
- [ ] "Vision via browser": executar testes **end-to-end** na app que está sendo desenvolvida (ex.: drive do navegador/Playwright), verificando o produto rodando — não só os testes unitários.
- [ ] Reporter dos resultados E2E na timeline do loop (evento novo no protocolo).

### [ ] E8.2 UX/UI Prototyper
- [ ] "Artefatos visuais": gerar mockups/pré-visualizações de UI a partir do escopo (ex.: HTML estático renderizável) para validar tela antes do Coder implementar.
- [ ] Preview do artefato na view da thread/workspace.

---

## [ ] E9 — UI v7 · Redesign & multi-thread (interface)
Converter o protótipo `pi_agent_manager_v7.html` na UI real. Materializa a **superfície de UI**
que a E5 (Fase C) previa (chat global, histórico/sessões, explorer de threads) — **sem**
persistência real, que permanece em E5. O motor (engine) não muda. (Plano: `PLAN-fix-uiux.md`.)

### [ ] E9.1 Shell & Orquestrador
- [ ] Layout `rail + main + explorer` (remover a sidebar esquerda).
- [ ] Modal **Orquestrador**: Iniciar Loop (disabled sem PLAN/PLAN completo), Abortar Loop, roster dos 4 agentes e acesso ao modal de modelos.
- [ ] Rail v7: Chat Global · Chat da Thread · Grafo (E3) · Loop · Explorer (toggle) · Settings.

### [ ] E9.2 Explorer de threads
- [ ] Árvore com seleção de thread ativa, estados (`ok`/`run`/`new`/`err`), legenda e `markAsSeen`.
- [ ] Estrutura multi-projeto (UI only, sem persistência).

### [ ] E9.3 Chat Global
- [ ] View real (view-bar "Visão total", botão Histórico, empty state e composer).

### [ ] E9.4 Histórico / Nova sessão (só UI)
- [ ] Modal com lista de sessões por branch + ação "Nova sessão (limpa contexto)" — seed estática; persistência real em E5.

### [ ] E9.5 Polimento & responsividade
- [ ] StatusBar com "thinking por agente".
- [ ] Explorer-drawer < 1180px e colapso < 860px.
