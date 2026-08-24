# Pi Factory — Agent Instructions (app/)

Este arquivo é a **fonte da verdade** de arquitetura e restrições para este app.
Leia e obedeça ANTES de tocar em qualquer código. O Techlead e o Coder devem
seguir estas regras estritamente.

---

## Propósito e Escopo

O `app/` é um **protótipo de app Desktop** (Tauri + React) que recria a automação
do script `configs/automacao.js` deste repositório usando o **SDK real do pi
coding agent** em vez de `execSync` + regex sobre stdout de CLI.

O que deve ser lembrado para sempre:

- **O "`@pi/sdk`" mencionado em relatórios externos é FICTÍCIO.** O pacote real é
  **`@earendil-works/pi-coding-agent`** (v0.84.x), e o SDK fica **dentro dele**.
  Não use a API `PiClient.generateObject/generateText/agentRun` — ela não existe.
  O que existe de programático (e é usado aqui) é:
  `createAgentSession({ cwd, tools, thinkingLevel, model })` → `{ session }`,
  `session.prompt(text)`, `session.subscribe(listener)`, `session.abort()`,
  `session.setModel(model)`, `session.getSessionStats()`, `session.dispose()`.
- **O SDK roda apenas em Node** (o pacote puxa TUI/bindings nativos e exige
  `node >= 22.19`). Por isso o motor é um **sidecar Node**, nunca a webview.

---

## Escopo da Primeira Versão Funcional (UI v5)

A primeira versão funcional = **núcleo + Fase B** — converter o protótipo
`app/prototype/pi_agent_manager_v5.html` na UI real, com o motor ligado.
Fontes da verdade: `ESCOPO.md` (escopo) e `EPICS.md` (ordem macro).

Decisões firmadas (riscos de tempo resolvidos):

1. **Inspector de docs = somente leitura.** A UI NUNCA edita `PLAN.md`/`TODO_BATCH.md`.
   Quem marca fase/status é o **engine** (edição determinística local). Sem
   `markPlan`/`activatePlan` interativos na versão 1. (Risco #1)
2. **Configuração de modelos = campos manuais.** Sem dropdown do registry: cada
   agente tem campos de texto para "modelo" e "opção de thinking", preenchidos à
   mão e persistidos localmente. Valores padrão podem vir do engine. (Risco #2)
3. **Performance = cap/dedupe.** A UI deve permanecer fluida em loops longos:
   agregar `token/thinking` por card de agente, limitar nº de cards e linhas do
   terminal (descartar os mais antigos), estado nunca cresce sem limite. (Risco #3)

A **Fase C** (chat com histórico real + dois loops em paralelo) fica **fora**.
A home v6 (`PLAN-workspace-home.md`) é o gate: app inicia vazio; explorer mostra
o path aberto e branches git; “nova thread” = `git checkout -b`. Sem API keys na UI.

---

## Stack e Ferramentas

| Camada | Escolha | Notas |
| :--- | :--- | :--- |
| Shell Desktop | **Tauri v2** | Rust `src-tauri/`; webview do sistema (sem bundling de Chromium) |
| UI | **React 19** + TypeScript **strict** | `strict: true`, sem `any` |
| Estilo | **Tailwind CSS v4** | via `@tailwindcss/vite` (sem `tailwind.config.js`); tokens em `src/styles.css` com `@theme` |
| Ícones | **lucide-react** | substitui emojis (offline, consistente) — nunca emojis em UI |
| Fonte | **JetBrainsMono Nerd Font Mono** | definida em `@theme` (fallbacks: JetBrains Mono → ui-monospace) |
| Validação | **Zod v4** | parse estruturado (eventos + saída do LLM) — **nunca** regex sobre texto de modelo |
| SDK | **@earendil-works/pi-coding-agent** (dependência do `engine/`) | `createAgentSession` + `AgentSession` |
| Gerenciador | **pnpm exclusivamente** | **pnpm, nunca npm.** Lockfiles `app/pnpm-lock.yaml` e `app/engine/pnpm-lock.yaml` |

> O frontend (`app/`) NÃO importa o SDK — ele vive só no `engine/`. A UI troca
> dados com o motor via protocolo JSON (stdin/stdout), com Zod validando os dois lados.

---

## Arquitetura (protótipo — deliberadamente sem design patterns complexos)

```
┌──────────────────────────────────────────────────────────────┐
│ UI (webview) — React + Tailwind                               │
│  src/hooks/useEngine.ts (reducer) · src/components/           │
└──────────────────────────┬───────────────────────────────────┘
                           │ Tauri invoke (engine_start/engine_send/engine_stop)
                           │ Tauri eventos (engine-event / engine-log / engine-exit)
┌──────────────────────────▼───────────────────────────────────┐
│ Rust bridge — src-tauri/src/lib.rs                            │
│  sobe o sidecar Node, encaminha stdout→eventos, escreve       │
│  comandos no stdin, mata o processo no fechamento             │
└──────────────────────────┬───────────────────────────────────┘
                           │ child process (node engine/dist/index.mjs)
┌──────────────────────────▼───────────────────────────────────┐
│ Engine — app/engine (Node sidecar)                            │
│  SDK do pi em processo · orquestrador do ciclo automacao.js   │
└──────────────────────────────────────────────────────────────┘
```

### Por que sidecar Node e não rodar o SDK na webview?
1. O SDK é Node-only (TUI + bindings nativos), não roda em webview.
2. Evita CORS/fetch customizado para o gateway (em Node, rede nativa).
3. Editamos arquivos do projeto-alvo com fs real e rodamos git com
   `child_process`; a verificação de testes fica com o agente testador (skill com
   ferramentas) — a webview não tem esses privilégios; precisaria de plugins.
4. Reaproveita 1:1 a lógica de `automacao.js`/`automacao-sdk.ts`.

### Tradeoffs aceitos (protótipo)
- **Node em runtime:** o app sobe `node` a partir do PATH. Em produção, empacotar
  o Node como sidecar binário do Tauri (`externalBin`) ou migrar o motor para Rust.
- **Dois `package.json`** (`app/` e `app/engine/`) em vez de monorepo: independência
  de dependências (a webview não carrega o SDK pesado).
- **Skip de CORS e auth**: o SDK usa a configuração do pi do usuário
  (`~/.pi/agent/auth.json` + `models.json`), a mesma que ele já usa no CLI `pi`.

---

## Estrutura de Pastas

```
app/
├── AGENTS.md                 ← este arquivo
├── ESCOPO.md                 ← escopo da 1ª versão funcional (núcleo + Fase B)
├── EPICS.md                  ← épicos/iniciativas macro do projeto
├── README.md                 ← como rodar
├── prototype/                ← mockup HTML de validação UI/UX (pi_agent_manager_v5.html)
├── package.json              ← UI (react/vite/tailwind/tauri plugins) — pnpm
├── pnpm-workspace.yaml       ← allowBuilds (esbuild/@tauri-apps/cli)
├── src-tauri/                ← shell Rust do Tauri v2
│   ├── src/lib.rs            ← bridge do engine (commands + eventos)
│   ├── tauri.conf.json
│   └── capabilities/default.json
├── src/                      ← React (App, hooks/useEngine, components/)
└── engine/                   ← sidecar Node (seu próprio package.json — pnpm)
    ├── src/protocol.ts       ← tipos + zod do transporte (espelhado no front)
    ├── src/orchestrator.ts   ← máquina de estados (recria automacao.js)
    ├── src/pi.ts             ← wrapper defensivo sobre o SDK real
    ├── src/repo.ts           ← fs escopado ao projeto-alvo + parse do PLAN.md
    ├── src/skills.ts         ← injeta SKILL.md/AGENTS.md no prompt dos agentes
    └── src/mock.ts           ← fluxo simulado para desenvolver a UI sem credenciais
```

---

## Protocolo (Engine ⇄ UI)

- **Comando** (UI → stdin, 1 linha JSON): `start | pause | resume | inject | stop | ping`.
- **Evento** (stdout → UI, 1 linha JSON): `ready, status, log, phase, phase-start,
  agent-start, token, thinking, agent-message, tool-call, tool-result, agent-end,
  test, qa-verdict, phase-done, commit, crisis, paused, resumed, injected, done,
  error, exit`.
- Schemas vivem em `engine/src/protocol.ts` e `src/lib/protocol.ts` (espelho).
  **Todo evento/comando é validado com Zod** antes de tocar no estado.

---

## Ciclo Orquestrado (recriação de `configs/automacao.js`)

1. **Leitor** → identifica a primeira fase pendente (`[ ]` no título do `PLAN.md`).
   Parse determinístico local primeiro; agente leitor com **Zod** como fallback.
2. **Techlead** → prompt com a skill `techlead` (lida de `skills/` do blueprint ou
   `.agents/skills/` do projeto) + `AGENTS.md` → gera `TODO_BATCH.md`.
3. **Coder** → prompt com a skill `coder`; executa o batch com ferramentas reais
   (read/bash/edit/write do SDK).
4. **Verificação (Testador)** → agente com a skill `testador`: roda a suíte de
   testes reais quando existe ou inspeciona os entregáveis do `TODO_BATCH.md` em
   projetos simples (sem comando de teste padrão). Escreve `test-result.json`.
5. **QA (Zod)** → julga `ESPERADO` / `INESPERADO` a partir do `error.log`.
6. **Fase concluída** → PLAN.md marcado de forma **determinística** (não via LLM)
   + `git commit` semântico.
7. **Estouro (3 tentativas)** → **Protocolo de Crise**: modelo sênior
   (default `deepseek-v4-flash`; troque via `PI_CRISIS_MODEL` para `grok-4-5` em produção)
   reescreve o `TODO_BATCH.md` e o fluxo para para auditoria humana.

### Diferenças intencionais vs. automacao.js
| Antes | Agora |
| :--- | :--- |
| `execSync("pi -p ...")` bloqueante | SDK em processo + eventos em streaming |
| regex sobre stdout do LLM | saída estruturada com **Zod** (reader/QA) |
| LLM editava o PLAN.md (frágil) | edição local determinística dos marcadores |
| `npm run test` | verificação pelo agente `testador` (suíte real ou entregáveis) |
| função de loop única (sem controle) | `pause` / `resume` / `inject` / `stop` (human-in-the-loop) |

---

## Modelos e Engines

- `PI_DEFAULT_MODEL` (default `llmgateway/deepseek-v4-flash`) — leitor/techlead/coder/QA.
- `PI_CRISIS_MODEL` (default `llmgateway/deepseek-v4-flash` — troque para `grok-4-5` em produção) — protocolo de crise (thinking `medium`).
- A UI envia a config de modelos por papel no comando `start`/`plan` (override do default);
  o Juiz TDD (`qa`) também dirige o leitor (fallback) e o protocolo de crise.
- Resolução por nome (`provider/modelId`) via `ModelRegistry` do SDK; se falhar,
  usa o modelo padrão do `~/.pi/agent`. Nunca quebra a execução.
- Taxonomia do GEM (`[⚡ Flash]`, `[🛠️ Pro-Standard]`, `[🧠 Pro-Complex]`) é
  **sugestão de direcionamento** lida do `TODO_BATCH.md`; no protótipo o thinking
  padrão do Coder é `low` e pode ser sobrescrito via `session.setThinkingLevel`.

---

## Regras Críticas

1. **pnpm sempre, nunca npm.** Comando de testes é `pnpm test`, build `pnpm build`.
2. **TypeScript strict** + sem `any` em código novo. `noUnusedLocals`/`noUnusedParameters`.
3. **Zero regex sobre texto de LLM.** Parsing estruturado com Zod (ler/QA).
   Regex é permitido apenas sobre markdown determinístico do `PLAN.md` (`repo.ts`).
4. **Estado do PLAN.md é edição de arquivo local**, não viagem extra ao modelo.
5. **Segredos**: nunca hardcode. O engine lê `~/.pi/agent` {auth.json,models.json}
   e os scripts documentados no `README.md`. Variável `PI_ENGINE_MOCK=1`/`--mock`
   ativa o modo simulado (sem credenciais).
6. **`AGENTS.md` do projeto-alvo é injetado** no prompt dos agentes via `skills.ts`
   (fonte da verdade arquitetural do projeto sendo automatizado).
7. **Não adicione arquitetura complexa** enquanto for protótipo (sem MVVM, sem
   stores globais, sem barrel files — regras uso `components/` + `hooks/` simples).
   Quando evoluir, registrar a mudança aqui.
8. **Inspector de docs é somente leitura** — a UI nunca altera `PLAN.md`/`TODO_BATCH.md`
   (quem edita é o engine). Config de modelos usa **campos manuais**, não dropdown.
9. **Performance é requisito:** cap/dedupe de eventos e linhas no terminal/UI;
   nada de estado ilimitado em execução longa.
10. **TDD + DRY são obrigatórios** (ver seção “Desenvolvimento Guiado por TDD e DRY”).
    Nenhuma fase/entrega é marcada `[x]` sem os testes correspondentes verdes.

---

## Desenvolvimento Guiado por TDD e DRY

Todo código novo segue **TDD estrito** e **DRY**, sempre na ordem **RED → GREEN**.

- **RED PHASE (primeiro):** escreva/atualize os testes (`.spec`/`.test`) que definem
  o comportamento esperado **ANTES** de qualquer código de produção. Rode a suíte e
  confirme que ela falha por não-implementação (falha controlada). Proibido tocar
  em código de produção nesta fase.
- **GREEN PHASE (depois):** implemente a menor quantidade de código para deixar os
  testes verdes. Rode a suíte até 100%. Nunca misture RED e GREEN do mesmo módulo
  na mesma entrega.
- **DRY:** não duplique lógica — extraia para função/componente reutilizável a
  partir do 2º uso. Repetições acidentais no protocolo (schemas Zod entre engine e
  UI) devem ser espelhadas de forma explícita e documentada, nunca copiadas à cega.
- **Ferramenta de teste:** Vitest + React Testing Library (frontend) e Vitest/Node
  (engine). Comando padrão: `pnpm test`. A configuração da suíte faz parte do setup
  e deve existir ANTES de implementar qualquer feature nova.

---

## Comandos

```bash
cd app
pnpm install                 # UI (locked no pnpm-lock.yaml)
cd engine && pnpm install    # sidecar (locked no engine/pnpm-lock.yaml)

pnpm tauri dev               # app desktop em desenvolvimento (exige Rust toolchain)
pnpm build                   # typecheck + build da UI
pnpm test                    # testes (Vitest) — TDD obrigatório
pnpm engine:build            # compila o sidecar (dist/index.mjs)
pnpm engine:typecheck        # typecheck do engine
node engine/scripts/smoke.mjs # smoke test do protocolo (modo mock)
```

Pré-requisitos (máquina real): Node ≥ 22.19, pnpm, **Rust toolchain**
(`rustup` + `cargo`), e (para modo real) a config `~/.pi/agent` já usada pelo CLI `pi`.

---

## Notas de Validação (é o que já foi verificado)

- Engine: `tsc --noEmit` limpo · `tsup` gera `dist/index.mjs` · smoke test do
  protocolo (ready/start/pause/inject/resume/stop/done/exit) passa.
- Frontend: `tsc --noEmit` limpo · `vite build` produz `dist/` · dev server sobe.
- **Não verificado aqui**: compilação Rust (sem toolchain neste ambiente) e uma
  execução real contra o gateway (sem credenciais neste ambiente). Modo `--mock`
  cobre a UI; o caminho real falha de forma graciosa com evento `error`.
