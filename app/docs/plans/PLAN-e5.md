# Plano de Execução — E5: Chat + Multi-thread (paralelo por workspace)

> **Épico:** E5 (EPICS.md) · Regras em AGENTS.md · Escopo macro em EPICS.md
> **Criado em:** 2026-08-26
> **Complexidade Geral:** [🧠 Pro-Complex]
> **Estado:** `[x]` feito · `[-]` em andamento · `[ ]` pendente

---

## Contexto / Decisões (não reabrir)

- **Objetivo do E5:** permitir **vários workspaces/branches abertos ao mesmo tempo**, com
  loops/agentes rodando **em paralelo**; **trocar o foco** de um projeto/branch (view ativa)
  **não pausa** o que está rodando. É a materialização da "Fase C" prevista no `EPICS.md`.
- **Abordagem B (decidida): multi-orquestrador em UM processo engine.** O spike no SDK
  (`@earendil-works/pi-coding-agent@0.84.2`) confirmou que `createAgentSession` **não tem
  estado global** (instancia `modelRuntime/settingsManager/sessionManager/resourceLoader`
  locais por chamada), então **múltiplas `AgentSession` concorrentes no mesmo processo
  funcionam**. A Abordagem A (multi-processo, 1 Node por workspace) fica de reserva — só se
  aparecer uma limitação de concorrência no SDK, o que o spike sugere **não existir**.
- **`sessionId` = id do workspace** (`projectDir`). Todo comando que mira um workspace e todo
  evento que pertence a uma execução carrega `sessionId`. A UI roteia por ele. O protocolo
  continua **uma linha JSON por comando/evento** (stdin/stdout), validado por **Zod nos dois
  lados** (`engine/src/protocol.ts` ⇄ `src/lib/protocol.ts`).
- **Histórico real = SDK `SessionManager` (JSONL).** As sessões são **arquivos JSONL
  append-only** sob `~/.pi/agent/sessions/<encoded-cwd>/`. O engine usa `SessionManager` do
  SDK por `cwd` (retomada via `continueRecent(cwd)`), e `createAgentSession({ continueSession:
  true })` já restaura sessão/modelo/thinking. **`localStorage` continua** só para **metadados
  de UI** (título derivado do 1º prompt, ordem, "lida"), não para o contexto real do agente.
- **Não mexer na semântica de `running` do gate atual até a Fase 2.** Hoje o `index.ts` tem um
  `running` global + um `gate` único; a Fase 2 troca por um **registro `Map<sessionId, Run>`**
  (cada `Run` com seu `Gate` + `AbortController` + `SessionManager` + flag `running`).
- **Custo/tokens por workspace já existe** (`loadUsageTotals(projectDir)` / `saveUsageTotals`)
  e deve ser **preservado** — a Fase 4 apenas indexa por `sessionId` sem regressão.
- **Lock de arquivo em `registerModelInPiAgent` já aplicado** (E5 pré-requisito): escrita em
  `~/.pi/agent/models.json` é serializada por `fs.open(path, "wx")` + TTL de lock órfão. Os
  **agents só leem** `models.json`; a escrita ocorre **apenas** na configuração (seletor).
- TDD estrito (RED → GREEN), pnpm sempre, `pnpm test` / `tsc --noEmit` / `vite build`.

---

## [ ] Fase 1 — Protocolo multi-sessão (`sessionId`) [🛠️ Pro-Standard]

### [ ] 1.1 RED — schema nos dois lados
- Adicionar `sessionId` (string, `min(1)`) aos **comandos** `start`, `plan`, `graph`, `pause`,
  `resume`, `inject`, `stop`, `crisis-accept`, `crisis-revert` em
  `engine/src/protocol.ts` (`EngineCommandSchema`) e no espelho `src/lib/protocol.ts`.
- Adicionar `sessionId` aos **eventos** de execução em ambos os lados: `status`, `log`, `phase`,
  `phase-start`, `plan-done`, `graph-start`, `graph-ready`, `graph-error`, `agent-start`,
  `token`, `thinking`, `agent-message`, `tool-call`, `tool-result`, `agent-end`, `test`,
  `qa-verdict`, `phase-done`, `commit`, `crisis`, `retry`, `paused`, `resumed`, `injected`,
  `done`, `error`.
- `ready`, `models-list-result` e `exit` ficam **globais** (sem `sessionId`).
- Teste: parse/validação aceita evento/commando com `sessionId` e rejeita sem `sessionId`
  onde obrigatório.

### [ ] 1.2 GREEN — espelho e tipagem
- Manter o espelho DRY documentado (sem cópia cega); atualizar `EngineCommand`/`EngineEvent`
  tipados na UI. Ajustar os `switch`/`handleEventDispatch` existentes para aceitar o campo novo
  (sem quebrar a chamada atual, que pode usar um `sessionId` temporário até a Fase 2).

---

## [ ] Fase 2 — Engine multi-orquestrador (Abordagem B) [🧠 Pro-Complex]

### [ ] 2.1 RED — registro de runs por `sessionId`
- Teste do `index.ts`: dois `start` com `sessionId` distintos **rodam em paralelo** (não há
  mais o `running` global bloqueando o segundo); dois `start` com **o mesmo** `sessionId` são
  ignorados com `log: warn` (já existe execução para aquele workspace).
- `stop`/`pause`/`resume`/`inject`/`crisis-*` roteiam para o `Gate` do `sessionId` correto
  (não para um `gate` único).

### [ ] 2.2 GREEN — `Map<sessionId, Run>` no `index.ts`
- Substituir `let running` global por um `const runs = new Map<string, Run>()`, onde `Run` =
  `{ gate, abort, running }`.
- `start`/`plan` criam (ou rejeitam, se já existe) o `Run` para o `sessionId`; `finally`
  remove do mapa.
- Handlers de `pause`/`resume`/`inject`/`stop`/`crisis-accept`/`crisis-revert` buscam o `Run`
  pelo `sessionId` antes de chamar `trigger*` no `gate` correspondente.

### [ ] 2.3 GREEN — `SessionManager` por `cwd` (retomada)
- Em `engine/src/pi.ts`, usar `SessionManager` do SDK por `cwd` do workspace (não um único
  global): `continueRecent(cwd)` ao retomar; `createAgentSession({ cwd, continueSession: true })`
  já restaura sessão/modelo/thinking. Emitir `sessionId` em `agent-start`/`agent-end`.

---

## [ ] Fase 3 — Rust bridge (repassar `sessionId`) [⚡ Flash]

- **Sem mudança de spawn/processo** (Abordagem B mantém um único processo engine). O bridge
  (`src-tauri/src/lib.rs`) continua encaminhando stdout→eventos e stdin→comandos.
- Verificar que o `sessionId` **não é descartado** no forwarding (deve chegar intacto à UI).
  Documentar que o isolamento é por `sessionId` no payload, não por processo.

---

## [ ] Fase 4 — UI por workspace (estado multi-sessão) [🧠 Pro-Complex]

### [ ] 4.1 RED — estado por `sessionId`
- `useEngine` deixa de ser um único `EngineUiState` e passa a **indexar por `sessionId`**
  (`Map<sessionId, EngineUiState>`), cada workspace com sua `timeline`, `status`, `tokens`,
  `cost`, `elapsed`, `phase`, `error`. Preservar `loadUsageTotals(projectDir)` (custo/tokens
  já separados por workspace).
- `handleEventDispatch` roteia eventos pelo `sessionId`; eventos globais (`ready`,
  `models-list-result`) atualizam estado comum.

### [ ] 4.2 GREEN — lista de workspaces + explorer por thread
- `App`/`Shell`/`ExplorerTree` suportam **lista de workspaces** (branches), cada um com estado
  (`ok`/`run`/`new`/`err`) derivado do `EngineUiState` daquele `sessionId`.
- Trocar a view ativa **não interrompe** os runs: o run continua no `Map` do engine e no
  estado da UI (o foco muda, o processo não pausa).

### [ ] 4.3 GREEN — indicador global de atividade
- Barra/rail mostra quantos workspaces estão rodando (soma dos `running` por `sessionId`) —
  para o usuário ver, de relance, que outros loops seguem em paralelo.

---

## [ ] Fase 5 — Chat Global (MVP: agregação + sumário) [🛠️ Pro-Standard]

- View "visão total" que **agrega** os eventos recentes de todos os workspaces (ordem por
  tempo), com **resumo compacto por workspace** (papel ativo, tokens, custo, status).
- **Sem** retrieval/contexto cruzado complexo nesta fase (fica como follow-up); o Chat Global
  é observação/agregação, não orquestração.

---

## [ ] Fase 6 — Integração, validação e documentação [⚡ Flash]

- Fluxo ponta a ponta: abrir 2+ workspaces, iniciar loop em cada um, trocar o foco e confirmar
  que ambos continuam rodando; retomada de sessão via SDK (`continueRecent`) sem perder
  contexto do agente.
- Atualizar `AGENTS.md` (seção **Protocolo** — `sessionId` + multi-run) e `EPICS.md` (marcar
  E5) e, se preciso, `ESCOPO.md`.
- `pnpm test` · `tsc --noEmit` · `vite build` · `pnpm --dir engine typecheck` ·
  `pnpm --dir engine build` · `node engine/scripts/smoke.mjs`.

---

## Fora de escopo

- **Abordagem A (multi-processo)** — só entra se o SDK revelar limitação de concorrência.
- **Retrieval/contexto cruzado avançado** no Chat Global (só agregação + sumário no MVP).
- **Persistência do histórico no localStorage** — o contexto real fica no JSONL do SDK;
  localStorage guarda só metadados de UI (título/ordem).
- Empacotamento Node/sidecar (E7.1), onboarding Graphify (E7), assinatura (E6).

## Riscos

- **Concorrência real no SDK:** o spike indica que não há estado global, mas loops pesados
  simultâneos podem disputar CPU/rede. Mitigação: começar com 2 workspaces no teste manual;
  se houver contenção, a Abordagem A (multi-processo) é o escape.
- **Corrupção de `models.json`:** já mitigada com lock (Fase pré-E5). Os agents só leem.
- **`sessionId` fora de ordem:** comandos/eventos sem `sessionId` válido são ignorados com
  `log` (Zod + gate), como no padrão atual de `crisis-*`.
- **Estado da UI crescendo com N workspaces:** manter o cap/dedupe por workspace (já existe
  `MAX_TIMELINE_ITEMS`); o estado global cresce no máximo com o nº de workspaces abertos.

---

## Resumo de Estimativas

| Fase | Complexidade | Estimativa |
|------|-------------|------------|
| Fase 1 | 🛠️ Pro-Standard | 3h |
| Fase 2 | 🧠 Pro-Complex | 5h |
| Fase 3 | ⚡ Flash | 30 min |
| Fase 4 | 🧠 Pro-Complex | 6h |
| Fase 5 | 🛠️ Pro-Standard | 4h |
| Fase 6 | ⚡ Flash | 1h |
| **Total** | | **~19h 30min** |

Primeira Fase no Techlead: **Fase 1** (`[🛠️ Pro-Standard]`).
