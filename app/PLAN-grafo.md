# Plano de Execução — E3: Grafo de Conhecimento (Graphify)

> **Épico:** E3 (EPICS.md) · Escopo em ESCOPO.md · Regras em AGENTS.md
> **Criado em:** 2026-08-19
> **Complexidade Geral:** [🛠️ Pro-Standard]
> **Protótipo:** `prototype/pi_graph2.html` (validação de UI/UX do viewer do grafo — evolução do `pi_graph.html`)
> **Estado:** `[x]` feito · `[-]` em andamento · `[ ]` pendente

---

## Contexto / Decisões (não reabrir)

- **Grafo = auxílio de navegação, nunca fonte da verdade.** Arquivos reais (read/bash) continuam soberanos; skill manda confirmar com `read` antes de editar.
- Gerar o grafo no **open do workspace** e no **fim de cada fase** (código commitado → grafo fresco para a fase seguinte). **Degradação graciosa** se o binário `graphify` não estiver instalado. Invocação: **`graphify update <projectDir>`** (subcomando determinístico, AST puro, sem chave LLM) — **nunca** `graphify .` (pipeline completo que exige API key em repos com docs/papers/imagens).
- Injetar **apenas** o `GRAPH_REPORT.md` (resumo compacto) junto com `AGENTS.md` no `buildSkillPrompt` — **nunca** o `graph.json` inteiro no prompt.
- **Viewer do grafo = iframe** exibindo o `graph.html` do projeto-alvo (não desenhar o grafo à mão). Webview do Tauri bloqueia `file://` → servir o conteúdo via comando `read_graph_file` (somente leitura, mesma guarda de path do `read_project_file`) + `srcdoc`; se assets relativos quebrarem, partir para protocolo custom.
- UI sem emojis (lucide-react, como o resto). Fora de escopo: dropdown de modelos/settings — esta fase não mexe nisso.
- TDD estrito (RED → GREEN), pnpm sempre, `pnpm test` / `tsc --noEmit` / `vite build`.

---

## [x] Fase 1 — Protótipo de UI/UX do grafo (validar antes) [🛠️ Pro-Standard]

### [x] 1.1 Protótipo `prototype/pi_graph2.html` (arquivo único html/css/js)
- [x] Local do viewer na UI (entrada no rail "Grafo") + toolbar **Ver grafo / Atualizar / Simular alterações / Nova aba / Gerar** + atalhos **⌘G** (gerar) e **⌘V** (ver).
- [x] Estados: sem grafo (empty com CTA) → gerando (progresso simulado) → com grafo (iframe com `graph.html`/amostra) → **desatualizado** (chip + ação Atualizar).
- [x] Iframe como estratégia de exibição (não desenhar o grafo manualmente).
- [x] Validar com o usuário antes de implementar (aprovar/ajustar).

---

## [x] Fase 2 — Geração do grafo no engine [🛠️ Pro-Standard]

### [x] 2.1 RED — comando `graph` + runner
- [x] Teste: `graphify update <projectDir>` é executado no projectDir (spawn); binário ausente → `ok:false` gracioso (sem quebrar o loop).

### [x] 2.2 GREEN
- [x] Comando `graph` no protocolo (engine + espelho no frontend) + handler no `index.ts`.
- [x] Runner `runGraphify(projectDir)` (spawn com timeout, captura stdout, confere se `GRAPH_REPORT.md`/`graph.json` foram criados).
- [x] Eventos `graph-start` / `graph-ready` / `graph-error`.

### [x] 2.3 RED — gatilhos open + fim de fase
- [x] Teste (mock): open do workspace e fim de fase (fase commitada) disparam a geração.

### [x] 2.4 GREEN
- [x] Engine: gatilho no `ready` (open do workspace) e no fim de cada fase bem-sucedida em `runOrchestrator`.
- [x] UI: botão "Regenerar grafo" → comando `graph`.

---

## [x] Fase 3 — Injeção do GRAPH_REPORT + regra nas skills [⚡ Flash]

### [x] 3.1 RED
- [x] `buildSkillPrompt` inclui `GRAPH_REPORT.md` quando presente e o ignora quando ausente.

### [x] 3.2 GREEN
- [x] Ler `GRAPH_REPORT.md` via `Repo` e injetar no bloco de contexto (junto com AGENTS.md), rotulado como "mapa de arquitetura (pode estar atrasado)".
- [x] Regra curta na skill do Coder/Testador: usar `graphify query` quando `graph.json` existir; **confirmar com `read`** antes de editar.

---

## [x] Fase 4 — Viewer do grafo no app [🛠️ Pro-Standard]

### [x] 4.1 RED
- [x] UI: ação "Ver grafo" abre o viewer; estados sem/com grafo e desatualizado espelham o protótipo (Fase 1).
- [x] Comando `read_graph_file` (somente leitura) devolve `graph.html` dentro do projectDir (mesma guarda anti `../`).

### [x] 4.2 GREEN
- [x] Rust: comando `read_graph_file` (path canônico + guarda). Frontend carrega via **iframe `srcdoc`** com o conteúdo do `graph.html`.
- [x] Toolbar do graph2 (**Ver grafo / Atualizar / Simular alterações / Nova aba / Gerar**) + badges de estado (`sem grafo` / `gerando` / `atualizado` / `desatualizado`) + banner de staleness + atalhos **⌘G**/**⌘V**.
- [x] Testes do viewer (render com/sem grafo, srcdoc recebido).

---

## [x] Fase 5 — Detector de staleness [⚡ Flash]

### [x] 5.1 RED
- [x] `graph.json` mais velho que a fonte mais nova → `stale=true`.

### [x] 5.2 GREEN
- [x] Helper de mtime (`repo.ts`/lib) exposto na UI: chip **"Grafo desatualizado — N arquivos mudaram"** + botão Atualizar (comando `graph`).
- [x] Quando stale, aviso no prompt dos agents ("o mapa pode estar atrasado — confirme com `read`").

---

## [x] Fase 6 — Integração & validação [⚡ Flash]

- [x] Fluxo ponta a ponta (real e mock): open → grafo gerado (se `graphify`) → agents recebem GRAPH_REPORT → viewer abre por iframe → chip de staleness correto.
- [x] `pnpm test`, `tsc --noEmit`, `vite build`, smoke test do protocolo.
- [x] Atualizar `AGENTS.md`/`ESCOPO.md` se surgir decisão nova.

---

## Fora de escopo

- Instalador/onboarding do Graphify (E7).
- MCP server do Graphify como tool do SDK.
- Auto-instalação do `graphifyy` (apenas detecção + ação guiada futura).

## Riscos

- **Iframe + `graph.html` local:** webview bloqueia `file://`; `srcdoc` pode perder assets relativos (o dashboard do graphify é uma página JS única? confirmar no 1º teste real). Fallback: protocolo custom no Tauri.
- **`graphify update` lento em repos grandes:** gatilhos no open/fim de fase; em repos muito grandes, intervalo configurável (fallback manual).
- **Parse local falha em linguagens/estruturas raras:** `ok:false` gracioso com mensagem acionável; fluxo atual 100% preservado.

---

## Resumo de Estimativas

| Fase | Complexidade | Estimativa |
|------|-------------|------------|
| Fase 1 | 🛠️ Pro-Standard | 2h |
| Fase 2 | 🛠️ Pro-Standard | 3h |
| Fase 3 | ⚡ Flash | 45 min |
| Fase 4 | 🛠️ Pro-Standard | 2h 30min |
| Fase 5 | ⚡ Flash | 30 min |
| Fase 6 | ⚡ Flash | 45 min |
| **Total** | | **~9h 30min** |

Primeira Fase no Techlead: **Fase 1** (`[🛠️ Pro-Standard]`).
