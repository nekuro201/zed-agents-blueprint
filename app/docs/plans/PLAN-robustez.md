# Plano de Execução — E4: Robustez do Loop

> **Épico:** E4 (EPICS.md) · Regras em AGENTS.md · Escopo macro em EPICS.md
> **Criado em:** 2026-08-25
> **Complexidade Geral:** [🧠 Pro-Complex]
> **Estado:** `[x]` feito · `[-]` em andamento · `[ ]` pendente

---

## Contexto / Decisões (não reabrir)

- **Telemetria = agregado por agente, nunca estado ilimitado.** `agent-end` passa a
  carregar `durationMs` (wall clock da sessão do agente) junto do `stats` já existente
  (`tokens`/`cost`). A UI agrega por papel (`planejador/leitor/techlead/coder/testador/qa/crise`)
  e por total — o estado cresce no máximo com o nº fixo de papéis, nunca com o nº de eventos.
  Persistência de telemetria em disco fica para E6 (observabilidade), não aqui.
- **Retry/backoff é para falha transitória de infraestrutura** (SDK/gateway/rede na criação de
  sessão ou no `prompt`/`waitForIdle`). **Nunca** aplica a `StopSignal`/abort e **não se confunde**
  com dois retries já existentes: `MAX_PARSE_ATTEMPTS` (correção de JSON no `structured`) e
  `MAX_TENTATIVAS_ERRO` (loop do coder sobre a verificação do testador). Backoff exponencial +
  jitter, configurável por env (`PI_RETRY_MAX`, `PI_RETRY_BASE_MS`, `PI_RETRY_BACKOFF_FACTOR`).
- **Crise vira estado de espera com ações explícitas** — não mais um `status: done` opaco. O
  engine faz **snapshot do `TODO_BATCH.md`** antes do agente `crise` reescrever, emite `crisis`
  enriquecido com o `diff` (unified) para inspeção, e aguarda `crisis-accept` (retoma o loop
  com o batch novo) ou `crisis-revert` (restaura o snapshot e para para auditoria humana).
- **"Reverter" = restaurar `TODO_BATCH.md`, não `git reset`.** As edições do coder das tentativas
  falhas são não-commitadas e misturadas ao trabalho do `crise`; um reset git arriscaria perder
  trabalho. O artefato do protocolo de crise é o `TODO_BATCH.md` — revertê-lo é determinístico e
  suficiente. (Se o usuário quiser reverter o working tree inteiro, é ação manual fora da UI.)
- **Estado por etapa = `stage` estruturado no `status`** (enum Zod), além do `detail` livre. A UI
  deriva o indicador de etapa de `stage` + pipeline existente. O status `stopping` (já no enum)
  passa a ser emitido de fato quando `stop` é solicitado, antes do encerramento.
- **Zod nos dois lados.** Todo evento/comando novo é validado com Zod, com espelho explícito entre
  `engine/src/protocol.ts` e `src/lib/protocol.ts` (DRY documentado, nunca cópia cega).
- TDD estrito (RED → GREEN), pnpm sempre, `pnpm test` / `tsc --noEmit` / `vite build`.

---

## [x] Fase 1 — Telemetria por agente (duração + custo/tokens) [🛠️ Pro-Standard]

### [x] 1.1 RED — esquema e agregação
- `agent-end` ganha `durationMs` (número, opcional para não quebrar compat) no
  `engine/src/protocol.ts` e no espelho `src/lib/protocol.ts`.
- Teste do reducer: `agent-end` acumula `tokens`/`cost`/`durationMs` por papel e no total,
  limitado ao nº de papéis (nunca cresce com o nº de eventos).

### [x] 1.2 GREEN — medição no engine + exibição na UI
- Medir duração real por sessão em `engine/src/pi.ts` (`agentRun` e `structured`) e emitir
  `durationMs` no `agent-end` (junto do `stats` existente).
- Helper puro `src/lib/telemetry.ts` que agrega por papel a partir da timeline (DRY) + teste.
- Exibir duração/tokens/custo por agente no card do terminal e um resumo compacto por papel
  no `LoopTop`/`StatusBar` (ícones lucide, sem emoji; reutilizar `formatTokens`/`formatCost`).

---

## [x] Fase 2 — Retry/backoff em falhas transitórias do SDK [🧠 Pro-Complex]

### [x] 2.1 RED — helper `withRetry`
- Teste de `withRetry(fn, opts)`: tenta de novo em erro transitório (network/5xx), respeita
  backoff exponencial + jitter, **não** tenta em `StopSignal`/abort, re-lança após
  `PI_RETRY_MAX`, e emite evento `retry` (`role`, `attempt`, `maxAttempts`, `delayMs`, `reason`).
- Validação Zod do evento `retry` nos dois lados do protocolo.

### [x] 2.2 GREEN — aplicar no wrapper do SDK
- Aplicar `withRetry` em `agentRun`/`structured` (criação de sessão + `prompt`/`waitForIdle`) em
  `engine/src/pi.ts`, com `signal` desligando o retry imediatamente.
- Config por env (`PI_RETRY_MAX=3`, `PI_RETRY_BASE_MS=1000`, `PI_RETRY_BACKOFF_FACTOR=2`) com
  fallback de default — sem quebrar o modo real/mock.
- UI: renderizar o evento `retry` no terminal como linha de log `warn` (visibilidade do backoff).
- Caminho mock demonstra um retry (ex.: uma falha transitória antes de uma execução bem-sucedida).

---

## [x] Fase 3 — Gestão de estado/erro do motor com indicadores por etapa [🛠️ Pro-Standard]

### [x] 3.1 RED — `stage` estruturado + `stopping` + contexto de erro
- `status` ganha `stage` opcional (enum Zod: `reading-plan | techlead | coder | testador | qa |
  crisis | commit | graph | plan`) nos dois lados.
- Teste: `stop` solicitado emite `status: stopping` (hoje o status existe mas nunca é emitido);
  erro inesperado emite `error` com contexto de fase/agente (não só a mensagem crua).

### [x] 3.2 GREEN — transições por etapa + indicador na UI
- Emitir `stage` em cada ponto do `runOrchestrator`/`generatePlan` (leitura do PLAN → techlead →
  coder → testador → QA → commit/crise) e `stopping` no handler de `stop` do `index.ts`.
- UI: indicador de etapa corrente derivado de `stage` (chip/breadcrumb acima do pipeline), sem
  duplicar o estado do pipeline — deriva da mesma fonte (`useEngine`).
- Tratamento de erro com contexto: `error` passa a carregar `fase?`/`role?` (opcionais) e a UI
  exibe o passo que falhou, com affordance clara para Parar/Reiniciar.

---

## [x] Fase 4 — Protocolo de crise com auditoria na UI [🧠 Pro-Complex]

### [x] 4.1 RED — máquina de estados da crise no engine
- Teste: ao estourar `MAX_TENTATIVAS_ERRO`, o engine faz snapshot do `TODO_BATCH.md`, roda o
  agente `crise`, emite `crisis` com `message` + `diff` e aguarda (estado `waiting`) — **não** vira
  `done` automaticamente.
- Comandos novos no protocolo (Zod): `crisis-accept` e `crisis-revert`.
- Teste: `crisis-accept` retoma o loop com o batch reescrito; `crisis-revert` restaura o snapshot
  do `TODO_BATCH.md` e encerra para auditoria humana.

### [x] 4.2 GREEN — implementação + card de crise na UI
- Engine: snapshot/restore determinístico do `TODO_BATCH.md` (via `Repo`), diff unificado simples,
  handlers de `crisis-accept`/`crisis-revert` no `index.ts`, e o gate da crise (reutilizar o padrão
  de espera de `checkpoint`/`resumeWaiters`, sem duplicar lógica).
- UI: card de crise no `EnginePanel`/terminal com **Inspecionar TODO_BATCH** (foca o inspector,
  que já é somente leitura), **Aceitar e continuar** (`crisis-accept`) e **Reverter e parar**
  (`crisis-revert`); estado `waiting` exibido com o rótulo de crise.
- Caminho mock demonstra a crise (falha nas 3 tentativas → card → aceitar/reverter).

---

## [ ] Fase 5 — Integração & validação [⚡ Flash]

- Fluxo ponta a ponta (mock e, quando houver credencial, real): telemetria por agente, retry/backoff
  visível, indicador de etapa correto, e crise com aceitar/reverter funcionando.
- Atualizar `AGENTS.md` (seção **Protocolo** — novos comandos/eventos) e `EPICS.md` (marcar E4)
  quando o fluxo estiver estável.
- `pnpm test`, `tsc --noEmit`, `vite build`, `pnpm engine:typecheck`, `pnpm engine:build` e o
  smoke test do protocolo (`node engine/scripts/smoke.mjs`).

---

## Fora de escopo

- Persistência/observabilidade real de telemetria (E6) — aqui é só agregação em memória por papel.
- Reverter o working tree inteiro via git (`crisis-revert` restaura apenas o `TODO_BATCH.md`).
- Onboarding/instalador do Graphify (E7) e Fase C (chat/multi-thread, E5).
- Trocar o motor para Rust ou empacotar Node como sidecar (E7.1).

## Riscos

- **Semântica de erro transitório do SDK:** distinguir network/5xx de erro definitivo pode exigir
  inspeção da mensagem/tipo do erro; sem tipagem clara, o `withRetry` pode re-tentar erro fatal
  (mitigação: classificar por padrões conhecidos e, na dúvida, não retentar — fail fast).
- **Diff do `TODO_BATCH.md` grande:** truncar o `diff` no evento `crisis` (limite) para não
  estourar o transporte; o texto completo segue no inspector (leitura sob demanda).
- **`crisis-accept`/`crisis-revert` fora de ordem:** gate da crise só aceita essas ações quando o
  estado é `waiting` pós-crise; comandos fora de ordem são ignorados com `log` (Zod + gate).
- **Atraso de `stopping`:** `stop` é cooperativo (checkpoints); o `status: stopping` é emitido
  imediatamente, mas o processo só encerra no próximo ponto seguro (documentar, sem mudar o modelo).

---

## Resumo de Estimativas

| Fase | Complexidade | Estimativa |
|------|-------------|------------|
| Fase 1 | 🛠️ Pro-Standard | 2h |
| Fase 2 | 🧠 Pro-Complex | 3h 30min |
| Fase 3 | 🛠️ Pro-Standard | 2h 30min |
| Fase 4 | 🧠 Pro-Complex | 3h 30min |
| Fase 5 | ⚡ Flash | 45 min |
| **Total** | | **~12h 15min** |

Primeira Fase no Techlead: **Fase 5** (E4 concluído).
