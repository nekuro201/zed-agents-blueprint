# Plano de Execução — Correção de Performance e Memória do Loop

> **Origem:** diagnóstico ASK (crash por memória >8GB durante loop + queda de FPS do sistema)
> **Regras em AGENTS.md · Escopo em ESCOPO.md (Decisão 3: "Performance = cap/dedupe")**
> **Criado em:** 2026-09-02
> **Complexidade Geral:** [🧠 Pro-Complex]
> **Estado:** `[x]` feito · `[-]` em andamento · `[ ]` pendente

---

## Contexto / Diagnóstico (não reabrir)

- **Sintoma A — memória >8GB:** o número de itens da timeline é capado
  (`MAX_TIMELINE_ITEMS`=500, `LOOP_TERMINAL_MAX_ITEMS`=400), **mas o conteúdo de cada
  card de agente cresce sem teto**: `text`/`thinking` acumulam todos os deltas do
  streaming (`a.text + ev.delta`) e `tools[]` acumula todas as tool-calls. No
  WebKitGTK (Linux/Tauri), texto renderizado tem overhead alto por nó e o GC é
  atrasado → heap do webview incha; com a UI ocupada, a fila de eventos do IPC
  também acumula. Cascata → swap → crash.
- **Sintoma B — FPS:** cada `token`/`thinking` do SDK vira um evento → um
  `dispatch` → re-render do App inteiro (sem `React.memo` em `TerminalLine`/
  `Pipeline`), recomputando `pipelineFromTimeline` + `aggregateTelemetry` (O(n))
  a cada render e refazendo layout de até 400 cards `whitespace-pre-wrap`. A
  thread da UI satura; com memória em swap, o sistema inteiro (incl. cursor)
  engasga.
- **Pico pontual no engine:** `unifiedDiff` usa LCS com tabela DP O(m×n). Um
  `TODO_BATCH.md` reescrito com dezenas de milhares de linhas (protocolo de crise)
  pode alocar GBs num único diff.
- **Decisão:** atacar os dois sintomas na raiz (mesmo vetor: streaming sem throttle
  + conteúdo sem cap) + limitar o diff do engine. Sem mudança de arquitetura.

---

## [x] Fase 1 — Cap de conteúdo por card de agente (reducer) [🛠️ Pro-Standard]

- `MAX_AGENT_TEXT = 100_000` chars por campo (`text` e `thinking`) e
  `MAX_AGENT_TOOLS = 200` tool-calls por card.
- `token`/`thinking`/`agent-message` truncam para o **limite mantendo a cauda**
  (conteúdo mais recente do streaming) e marcam `capped` no card.
- `tool-call` descarta a tool-call mais antiga ao estourar o teto.
- Indicador "conteúdo truncado" no card do terminal (transparência pro usuário).
- Testes do reducer: cap de `text`, cap de `thinking`, cap de `tools`, flag `capped`.

## [x] Fase 2 — Batch dos deltas de streaming (hook) [🧠 Pro-Complex]

- `token`/`thinking` entram num buffer por papel (`Map<role, {text, thinking}>`)
  em vez de `dispatch` a cada delta.
- Flush agendado a cada `STREAM_FLUSH_MS = 200ms` e flush síncrono **antes** de
  qualquer evento não-stream (garante que `agent-end`/`agent-start` vejam o card
  completo antes de fechar/abrir).
- Reduz re-renders de dezenas por segundo para ~5/seg, sem mudar o protocolo.

## [x] Fase 3 — Memoização do terminal e do pipeline [🛠️ Pro-Standard]

- `TerminalLine` em `React.memo` (comparação por referência do `item`): num evento
  de streaming, só o card afetado re-renderiza — os ~399 restantes pulam.
- Callbacks de crise estáveis (noop de `onFocusInspector` hoisted em `EnginePanel`)
  para o memo não quebrar.
- `Pipeline` em `React.memo` com comparador por conteúdo (id/label/status/model):
  deltas de streaming não re-renderizam o pipeline; só `agent-start`/`agent-end`.

## [x] Fase 4 — unifiedDiff limitado (engine) [🛠️ Pro-Standard]

- Teto `MAX_LCS_CELLS = 2_250_000` para a tabela DP do LCS (O(m×n) em memória).
- Acima do teto, fallback `trimDiff` (prefixo/sufixo comum, O(m+n)) — suficiente
  para o evento `crisis` (diff já é truncado em `maxLen` na UI).
- Teste com arquivos grandes exercitando o fallback.

## [x] Fase 5 — Log de memória do engine + validação [⚡ Flash]

- Log `debug` de RSS/heap ao fim de cada iteração de fase no `runOrchestrator`
  (invisível na UI — o reducer ignora `debug` — mas útil ao rodar o engine standalone
  ou monitorar via stdout).
- `pnpm test`, `tsc --noEmit`, `vite build`, `pnpm engine:typecheck`, `pnpm engine:build`.

## [x] Fase 6 — Isolamento do estado de streaming (store + seletores) [🧠 Pro-Complex]

- O `useEngine` deixa de retornar `state`: o estado vive num **store externo**
  (singleton do app, `useSyncExternalStore`) em `useEngine.ts`.
- Consumidores: `useEngineState()` (EnginePanel — tempo real), `useEngineSelector(sel)`
  (App assina só slices de baixa frequência) e `usePlannerCard()` (card do Planejador
  cacheado por referência do card de agente).
- `StatusBar` assina `elapsed` direto (tick 1×/seg não re-renderiza a árvore).
- `dispatch` não notifica listeners quando o estado não mudou (ex.: debug logs).
- Resultado: durante um loop, os flushes de streaming (5/seg) re-renderizam apenas
  o painel do loop — App, Chat da Thread, Grafo, StatusBar e Home ficam parados.
- Testes: `useEngine.store.test.tsx` (re-render seletivo, plannerCard estável, reset).
- Registrado no AGENTS.md (regra 7 — evolução de arquitetura).

## [x] Fase 7 — Indicador de memória no rodapé [🛠️ Pro-Standard]

- **Motivação:** acompanhar o consumo durante loops longos sem abrir o htop
  (o crash de >8GB e a lentidão só foram percebidos fora do app).
- **Rust** (`process_memory`): lê `VmRSS` em `/proc/<pid>/status` e devolve
  `{ app, webview, engine }` em bytes. `webview` soma os `WebKitWebProcess` **da
  nossa árvore de processos** (sobe até 6 níveis no ppid porque o WebKitGTK usa
  sandbox `bwrap`); `engine` usa o PID do sidecar já mantido em `EngineState`.
  Fora do Linux → `null` (degradação graciosa, sem dependência nova).
- **UI** (`MemoryChip`): chip no rodapé com o total + dot colorido
  (≥2GB âmbar, ≥4GB vermelho) e tooltip com o detalhamento UI · Motor · App.
  `MemoryChipView` é apresentacional (testável); o polling de 3s vive no container
  (`useProcessMemory`), então só o chip re-renderiza — a árvore segue intacta.
- **Testes:** `memory.test.ts` (total/nível/tooltip), `MemoryChip.test.tsx`
  (vazio, soma, limiares), `format.test.ts` (`formatBytes`) e, no Rust,
  `ppid_of` + leitura real do `/proc` do próprio processo.

---

## Fora de escopo

- Migrar o diff para Myers (mais complexo; o fallback O(m+n) já elimina o pico).
- Monitorar/observabilidade de memória em disco (E6).

## Riscos

- **Tail-truncation perde o início do texto/thinking** (mitigado pelo indicador
  `capped` no card — o usuário sabe que foi cortado e vê o final do streaming).
- **Batch atrasa deltas em até 200ms** (imperceptível na prática; flush síncrono
  antes de eventos de estrutura preserva a ordem).
- **Fallback de diff menos "ótimo"** em arquivos gigantes (só atinge o caso
  patológico; o diff de crise já é truncado em 3000 chars).

---

## Resumo de Estimativas

| Fase | Complexidade | Estimativa |
|------|-------------|------------|
| Fase 1 | 🛠️ Pro-Standard | 1h |
| Fase 2 | 🧠 Pro-Complex | 2h |
| Fase 3 | 🛠️ Pro-Standard | 1h |
| Fase 4 | 🛠️ Pro-Standard | 1h |
| Fase 5 | ⚡ Flash | 30min |
| **Total** | | **~5h 30min** |
