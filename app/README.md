# Pi Factory (app/)

Protótipo de app **Desktop** que recria a automação do `configs/automacao.js`
usando o **SDK real do pi coding agent** (`@earendil-works/pi-coding-agent`),
com **Tauri 2 + React 19 + TypeScript + Tailwind v4 + Zod**.

A ideia central: substituir o padrão frágil `execSync("pi -p ...")` + regex sobre
stdout por um **motor em processo** com eventos em streaming, saída estruturada
com Zod, barra de progresso do `PLAN.md` e **human-in-the-loop** (pausar, injetar
correção, retomar).

> ⚠️ O `@pi/sdk` citado em análises externas **não existe** no npm. O pacote real
> é `@earendil-works/pi-coding-agent` e o SDK programático é `createAgentSession`
> + `AgentSession`. Detalhes e regras em [`AGENTS.md`](./AGENTS.md).

---

## Como rodar

Pré-requisitos: **Node ≥ 22.19**, **pnpm** e **Rust toolchain** (para o shell Tauri).

```bash
cd app
pnpm install          # UI (React/Vite/Tailwind/Tauri)
cd engine && pnpm install && cd ..   # sidecar Node (SDK do pi)

pnpm engine:build     # compila o motor -> engine/dist/index.mjs
pnpm tauri dev        # abre o app desktop
```

### Sem credenciais (modo simulado)
Marque **"Modo simulado"** na UI (ou rode o motor com `---mock`). O fluxo pré-gravado
percorre 3 fases e demonstra pause/inject/resume sem nenhuma chave.

### Modo real
O motor usa a **mesma configuração do CLI `pi`** do seu usuário
(`~/.pi/agent/auth.json` e `models.json`). Se você já roda `pi -p` no terminal,
deve funcionar direto. O app NÃO guarda chaves — tudo vive no `~/.pi/agent` local.

Variáveis de ambiente do engine (opcionais):

| Var | Default | Significado |
| :--- | :--- | :--- |
| `PI_DEFAULT_MODEL` | `llmgateway/deepseek-v4-flash` | modelo dos agentes do ciclo |
| `PI_CRISIS_MODEL` | `llmgateway/deepseek-v4-flash` | modelo sênior no protocolo de crise (troque p/ `grok-4-5` em produção) |
| `PI_SKILLS_DIR` | — | onde buscar os `SKILL.md` (senão usa `.agents/skills` do projeto ou `../skills`) |
| `PI_ENGINE_MOCK` | — | `1` força modo simulado |
| `PI_ENGINE_PATH` | `<app>/engine/dist/index.mjs` | caminho do motor p/ o Rust |

---

## Fluxo na tela

1. Escolha o **diretório do projeto-alvo** (aquele que tem `PLAN.md` e `AGENTS.md`).
2. Clique **▶ Iniciar** — o ciclo roda: leitor → techlead → coder → testes → QA.
3. Acompanhe a **timeline**: cards de raciocínio (`<thinking>`), tool calls,
   saída de testes, veredito do QA, commits e barra de progresso.
4. Use **⏸ Pausar** a qualquer momento, digite num card de **injeção de correção**
   e **▶ Retomar** — a correção entra no próximo passo do agente.

---

## Estrutura

```
app/
├── AGENTS.md            ← regras e decisões de arquitetura (leia antes de mexer)
├── src/                 ← UI React (App, hooks/useEngine, components/)
├── src-tauri/           ← bridge Rust do Tauri v2 (sobe o motor, encaminha eventos)
└── engine/              ← motor Node (SDK do pi + orquestrador + parse Zod)
```

## Scripts úteis

```bash
pnpm dev                  # só a UI no navegador (sem motor — aviso na tela)
pnpm build                # typecheck + build da UI
pnpm engine:build         # build do motor
pnpm typecheck            # typecheck da UI  (pnpm --dir engine typecheck para o motor)
node engine/scripts/smoke.mjs   # smoke test do protocolo (mock)
pnpm tauri dev            # app desktop completo
```

> Nota para quem clonar/instalar em máquina nova: se o pnpm reclamar de build
> scripts bloqueados (`Ignored build scripts`), rode `pnpm approve-builds` e
> aceite `esbuild` e `@tauri-apps/cli`. A config `onlyBuiltDependencies` já está
> em `app/pnpm-workspace.yaml` para os novos pnpm.
