# Plano de Execução — Home v6 + Workspace (caminho real)

> **Issue:** Tela inicial de projeto (v6) + explorer do caminho aberto + settings de modo/API
> **Épico:** E2 (extensão da UI v5) — fatia de explorer, sem Fase C (histórico persistido / multi-projeto paralelo)
> **Criado em:** 2026-08-18
> **Complexidade Geral:** [🛠️ Pro-Standard]
> **Protótipo de fidelidade:** `prototype/pi_agent_manager_v6.html` (home) + workspace = UI v5 já implementada
> **Estado:** `[x]` feito · `[-]` em andamento · `[ ]` pendente

---

## Contexto / Decisões (não reabrir)

- App **inicia vazio**. Não restaurar automaticamente `pi-factory:last-project` para o workspace. Recentes existem; entrar é ação explícita.
- Sem pasta aberta: **proibido** montar Chat da Thread / Chat Global / Loop. Só a home v6.
- **Um workspace ativo por vez.** Botão “adicionar workspace” troca/abre outro caminho (não monitora dois loops em paralelo — `AGENTS.md`).
- Explorer da direita deixa de ser placeholder: mostra o **projeto do caminho aberto** + branches git reais como threads.
- **Nova thread** = criar branch git no repo aberto (HEAD atual) e selecioná-la. Sem histórico de chat persistido (Fase C continua fora).
- Segredos: **nunca** campo de API key no app. Auth continua em `~/.pi/agent`. Settings da home = modo simulado/real + modelo/thinking (já manuais) + vars não-secretas (`PI_DEFAULT_MODEL`, comando de teste).
- DRY: reutilizar `pickDirectory`, `ModelSettingsModal`, `useEngine` mock, Shell v5. Home é um *shell-level gate*, não um segundo ProjectBar dentro da thread.
- TDD estrito (RED → GREEN) e sem emojis (lucide-react).

---

## [x] Fase 0 — Contrato de sessão de workspace [⚡ Flash]

### [x] 0.1 Tipos + persistência (recents, não auto-open)
- Tipo `WorkspaceSession`: `{ name, path, openedAt }` validado com Zod.
- Persistência: lista de recentes (`pi-factory:recents`). **Não** hidratar o workspace no boot a partir do último path.
- Sessão ativa fica só em memória (fecha o app → volta à home).

### [x] 0.2 RED → GREEN
- Testes: boot sem sessão; upsert de recente por path; remover recente; parse Zod rejeita payload corrompido.

---

## [x] Fase 1 — Home v6 (gate do app) [🛠️ Pro-Standard]

### [x] 1.1 RED — Home bloqueia o workspace
- Sem sessão: App renderiza home (hero “Abrir um projeto”, CTAs Novo/Abrir, recentes ou empty).
- Sem sessão: rail/Chat/Loop **não** aparecem.
- Recentes: nome + path + “há X”; remover não abre o projeto.

### [x] 1.2 GREEN — UI fiel ao v6
- Layout: titlebar + home-wrap (720px) + statusbar “Nenhum projeto aberto”.
- **Novo projeto** / **Abrir pasta**: modal (nome + path + Escolher via `pickDirectory`). Path vazio não confirma.
- Confirmar / clicar recente → sobe o workspace v5 com aquele `path`.
- Lucide, tokens do tema já alinhados ao ouro v5/v6.

---

## [x] Fase 2 — Abrir / fechar workspace [⚡ Flash]

### [x] 2.1 RED
- Abrir pasta → home some, Shell v5 monta com `projectDir = path`.
- Fechar (titlebar “Projetos” / fechar no explorer) → volta à home; Chat/Loop desmontam.
- Último workspace fechado (zero abertos) → home obrigatória.

### [x] 2.2 GREEN
- Titlebar no workspace: submarca `/ {name}` + botão voltar a Projetos.
- Statusbar: path do projeto aberto.
- Remover o gate de pasta de *dentro* da Chat da Thread (a home é o único seletor). Modo simulado sai da thread e vai para settings da home (Fase 3).
- `generatePlan` / `start` só disparam com sessão ativa.

---

## [x] Fase 3 — Settings da home: modo teste vs real + vars [🛠️ Pro-Standard]

### [x] 3.1 RED
- Home mostra chip/estado **Modo simulado** ou **Modo real**.
- Modal Configurações: toggle mock; campos manuais de modelo/thinking (reusar `ModelSettingsModal` ou unificar); campos texto para `PI_DEFAULT_MODEL` e comando de teste (`PI_TEST_COMMAND`, default `pnpm test`).
- Sem campo de API key. Salvar persiste local (Zod) e o `mock` segue para `engineStart(..., mock)`.

### [x] 3.2 GREEN
- Botão de engrenagem na titlebar da home (e atalho existente ⌘, se já houver).
- Valores padrão do engine; persistência local já usada em `modelConfig`.
- Toggle visível na home sem abrir o modal (atalho do modo).

---

## [x] Fase 4 — Explorer real + toggle + nova thread [🛠️ Pro-Standard]

### [x] 4.1 RED — árvore = caminho aberto
- Explorer lista **um** grupo: nome do projeto (basename do path) + branches git do repo.
- Sem git / falha: grupo com path e empty “sem branches” (não quebra a UI).
- Branch atual destacada (`run` ou equivalente). Placeholders “Frontend E-commerce” / “Backend API Hub” **somem**.

### [x] 4.2 GREEN — ações do explorer (Zed-like)
- **Toggle** mostrar/esconder o painel (⌘B se já existir; senão botão no rail/titlebar). Painel fechado não some o resto do shell.
- **Fechar workspace** no explorer → Fase 2 (volta home se zero).
- **Adicionar workspace**: mesmo fluxo da home (pick pasta). Troca o path ativo; recente atualizado. Não abre segundo loop.
- **Nova thread**: prompt de nome da branch → `git checkout -b <nome>` no `projectDir` (via comando Tauri/engine, cwd escopado ao path). Sucesso: lista recarrega e a nova branch fica selecionada. Falha: erro visível, sem crash.
- Sem persistência multi-projeto paralela e sem histórico de chat (Fase C).

---

## [x] Fase 5 — Integração e validação [⚡ Flash]

### [x] 5.1 Fluxo ponta a ponta
- Boot vazio → home → Abrir pasta → workspace v5 (chat/loop liberados) → explorer mostra o path/branches → Nova thread cria branch → toggle esconde explorer → Fechar → home.
- Modo simulado na home → Iniciar Loop usa `--mock`.
- Chat/Loop inacessíveis com home visível.

### [x] 5.2 Qualidade
- `pnpm test` verde, `tsc --noEmit`, `vite build`.
- Atualizar `ESCOPO.md` / `EPICS.md` / `AGENTS.md`: home é o gate; explorer reflete um path; multi-projeto paralelo e chat persistido continuam Fase C.

---

## Fora de escopo (permanece Fase C / E4)

- Histórico real de conversa por thread.
- Dois projetos rodando loop ao mesmo tempo.
- Edição manual de `PLAN.md` pela UI.
- Cadastro de API keys no app.

## Riscos

- **Git no sidecar vs Rust:** preferir um comando Tauri `git_branches` / `git_checkout_new` com path canônico (mesmo guarda de `read_project_file` contra `../`). Não shell aberto na webview.
- **“Novo projeto” vs “Abrir pasta”:** v6 é o mesmo modal; “novo” não scaffolda repo — só nomeia e abre a pasta. Scaffold fica fora.
- **Branch suja:** `checkout -b` pode falhar; só reportar, não stash automático.

---

## Resumo de Estimativas

| Fase | Complexidade | Estimativa |
|------|-------------|------------|
| Fase 0 | ⚡ Flash | 45 min |
| Fase 1 | 🛠️ Pro-Standard | 2h |
| Fase 2 | ⚡ Flash | 1h |
| Fase 3 | 🛠️ Pro-Standard | 1h 30min |
| Fase 4 | 🛠️ Pro-Standard | 2h 30min |
| Fase 5 | ⚡ Flash | 45 min |
| **Total** | | **~8h 30min** |

Primeira Fase a fatiar no Techlead: **Fase 0** (`[⚡ Flash]`).
