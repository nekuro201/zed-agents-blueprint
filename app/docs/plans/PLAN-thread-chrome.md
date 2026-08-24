# Plano de Execução — Chrome da Thread + Explorer (pós-home)

> **Issue:** Composer Enter, sidebar da thread, Iniciar Loop, Parar no Loop, explorer com ícones e branch default
> **Épico:** E2 (polimento da UI v5 dentro do workspace da home v6)
> **Criado em:** 2026-08-18
> **Complexidade Geral:** [🛠️ Pro-Standard]
> **Protótipo:** `prototype/pi_agent_manager_v5.html` (composer/send, settings dos agents, Iniciar Loop) + explorer real da home v6
> **Estado:** `[x]` feito · `[-]` em andamento · `[ ]` pendente

---

## Contexto / Decisões (não reabrir)

- Home v6 continua o único gate de pasta. Sem sessão = sem Chat/Loop.
- Um workspace ativo por vez. Sem API key na UI. Inspector só leitura.
- Pause / Retomar / Injetar **saem da sidebar da thread**. Human-in-the-loop fica de fora desta fatia (não reintroduzir InjectBar na thread).
- Loop: **só Parar** (stop/abort). Sem Pausar/Retomar/Injetar na view do Loop.
- “Iniciar Loop” desabilitado sem `PLAN.md`; com plano, clica → `setView("workspace")` **e** `actions.start(...)`.
- Settings dos agents = `ModelSettingsModal` já existente (campos manuais). Ícone na sidebar da thread (igual v5).
- Label do workspace ativo = `session.name` (basename do path), **nunca** `feature/auth-ui` hardcoded.
- Explorer: um botão no **topo** = adicionar/abrir outro workspace (troca o path). Fechar workspace e nova branch = **ícones** na linha do projeto. Cada branch tem ícone de ação (selecionar / indicar atual). Sem git: thread default `(default)`; nova branch avisa e **não** chama `git checkout -b`.
- Composer: **Enter envia**; Shift+Enter quebra linha. Botão Enviar alinhado ao canto do box (v5 `.send`).
- TDD RED → GREEN. Sem emojis (lucide). DRY: reusar `ModelSettingsModal`, `hasPlan`, `createGitBranch`.

---

## [x] Fase 1 — Composer: Enter envia + alinhamento do Enviar [⚡ Flash]

### [x] 1.1 RED
- Enter (sem Shift) no textarea chama `onGenerate` e limpa o campo.
- Shift+Enter **não** envia (insere quebra).
- Botão Enviar tem âncora bottom-right do box (teste de classe/posição ou `title` + container `relative`).

### [x] 1.2 GREEN
- Trocar o atalho atual (Ctrl/Cmd+Enter) para Enter simples.
- Alinhar o botão ao protótipo v5 (ícone ArrowUp lucide, 30×30, canto do box). Sem texto “Enviar” se quebrar o alinhamento — `aria-label="Enviar"` obrigatório.

---

## [x] Fase 2 — Sidebar da Thread: só Iniciar Loop + settings + label real [🛠️ Pro-Standard]

### [x] 2.1 RED
- Sem `hasPlan`: “Iniciar Loop” `disabled`; clique não chama `onStart`.
- Com `hasPlan`: clique chama `onStart` (uma vez).
- Não renderiza Pausar / Retomar / Parar / Injetar na sidebar.
- Mostra `activeLabel` recebido (não string fixa).
- Botão de configuração (`aria-label` Configurar thread / Modelos) presente.

### [x] 2.2 GREEN
- Remover controles extras da `Sidebar`.
- App passa `activeLabel={session.name}` (e branch atual se já houver, senão o nome do projeto).
- Ícone sliders/settings abre `ModelSettingsModal` (load/save `modelConfig`).
- Shell: `onStart` com plano → navega para Loop **e** dispara start do engine.

---

## [x] Fase 3 — Loop: um botão Parar [⚡ Flash]

### [x] 3.1 RED
- View Loop **não** contém Pausar / Retomar / Injetar.
- Contém um único controle de interrupção “Parar” (ou Abortar), habilitado só com `running`.
- Clique chama `onStop`.

### [x] 3.2 GREEN
- Colocar Parar no `LoopTop` (arts, à direita dos chips) ou faixa mínima do loop — **não** na sidebar da thread.
- Sidebar permanece só com Iniciar Loop mesmo com o Loop visível.

---

## [x] Fase 4 — Explorer: ícones, branch default, aviso sem git [🛠️ Pro-Standard]

### [x] 4.1 RED
- Topo do explorer: só “Adicionar workspace” (ou ícone folder-plus).
- Linha do projeto: ícone fechar + ícone nova branch (sem botões texto “Fechar workspace” / “Nova thread” no corpo).
- Sem git / lista vazia: uma branch `(default)` com status distinto.
- `onNewThread` com `hasGit=false` **não** chama create; UI mostra aviso (“configure git no projeto”).
- Com git: nova branch segue o fluxo atual (`checkout -b`); falha continua visível.

### [x] 4.2 GREEN
- Ao abrir workspace: se `git_branches` ok → lista real, atual = `run`. Se falhar/vazio → grupo com `(default)`.
- Ícone por branch (GitBranch lucide); branch atual destacada.
- Abrir workspace sempre seleciona uma thread: current git **ou** `(default)`.
- Sem persistir multi-projeto paralelo.

---

## [x] Fase 5 — Integração [⚡ Flash]

### [x] 5.1 Fluxo
- Home → abrir pasta → Chat da Thread: Enter envia; sidebar só Iniciar (disabled sem PLAN); settings abre modal.
- Com PLAN: Iniciar Loop vai ao Loop e começa; Loop tem só Parar.
- Explorer: path + `(default)` ou branches; ícones fechar/nova; sem git, nova branch avisa.

### [x] 5.2 Qualidade
- `pnpm test`, `tsc --noEmit`, `vite build`.
- Atualizar `ESCOPO.md` se a decisão “só Parar no Loop / sem inject na thread” for permanente nesta versão.

---

## Fora de escopo

- Pause / inject / histórico de chat (Fase C / E3).
- Dois workspaces em loop paralelo.
- Scaffold de git init automático.

## Riscos

- Enter no textarea: impedir submit vazio e IME (compor acentos) — só enviar se `!e.nativeEvent.isComposing`.
- `window.prompt` da nova branch: se não houver git, **não** abrir prompt; mostrar aviso inline no explorer.

---

## Resumo de Estimativas

| Fase | Complexidade | Estimativa |
|------|-------------|------------|
| Fase 1 | ⚡ Flash | 45 min |
| Fase 2 | 🛠️ Pro-Standard | 1h 30min |
| Fase 3 | ⚡ Flash | 30 min |
| Fase 4 | 🛠️ Pro-Standard | 1h 30min |
| Fase 5 | ⚡ Flash | 30 min |
| **Total** | | **~4h 45min** |

Primeira Fase no Techlead: **Fase 1** (`[⚡ Flash]`).
