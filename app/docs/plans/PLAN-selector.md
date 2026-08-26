# Plano de Execução — E10: Seletor de Modelos com Preço (drop-down + busca)

> **Épico:** E10 (novo — ver EPICS.md) · Regras em AGENTS.md · Escopo macro em EPICS.md
> **Criado em:** 2026-08-26
> **Complexidade Geral:** [🧠 Pro-Complex]
> **Estado:** `[x]` feito · `[-]` em andamento · `[ ]` pendente

---

## Contexto / Decisões (não reabrir)

- **Config de modelos hoje = campos de texto livre** (`modelConfig.ts` / `ModelSettingsModal.tsx`). O valor não resolve o custo real porque o SDK do pi calcula o custo **localmente** a partir de `model.cost` ($/milhão de tokens) do `~/.pi/agent/models.json` — sem esse campo, `getSessionStats().cost` é sempre 0.
- **Objetivo do E10:** adicionar um **seletor com busca** (drop-down pesquisável) que consulta a API pública do llmgateway (`GET https://api.llmgateway.io/v1/models`), lista os modelos disponíveis com seus preços reais, e preenche o campo de texto automaticamente. O preço (`pricing`) da API é usado para **calcular o custo em memória no engine** — não escrevemos no `models.json` do usuário (evita efeito colateral no CLI `pi`).
- **Sync de modelos/preço no boot do app** (não a cada loop): o engine busca a lista de modelos e o pricing **uma vez no `ready`** (ou quando a UI envia `models-list`). O resultado fica em cache em memória no engine (válido até o processo morrer). O custo emitido nos eventos `agent-end` passa a vir do **cálculo em memória** (`tokens × pricing`), não do `getSessionStats()`.
- **Campo de texto livre NÃO é removido** — o seletor é um atalho de conveniência. O usuário pode digitar um modelo customizado (ex.: `my-provider/my-model`) que o seletor não lista. Quando seleciona do drop-down, o campo é preenchido e o preço é conhecido; quando digita manual, o custo fica 0 (sem preço conhecido) e o aviso "preço não configurado" permanece.
- **O fetch vai no engine** (Node, sem CORS, mesma filosofia do sidecar). A UI não bate direto na API do llmgateway.
- **Auth:** a API do llmgateway é pública (`/v1/models`) — não requer API key. Se no futuro exigir, a chave fica no `~/.pi/agent` e o engine lê de lá (mesmo padrão do `AGENTS.md` regra 5).
- **Sem dependência nova** — `fetch` nativo do Node 22+.
- **Zod nos dois lados** (protocolo espelhado engine ⇄ UI), TDD estrito (RED → GREEN), pnpm sempre.

---

## [x] Fase 1 — Comando `models-list` no engine (fetch + cache) [🛠️ Pro-Standard]

### [x] 1.1 RED — protocolo
- Comando `models-list` e evento `models-list-result` nos dois lados do protocolo (Zod).
- `models-list: { type: "models-list" }` (comando simples, sem payload).
- `models-list-result: { type: "models-list-result"; models: Array<{ id: string; name: string; provider: string; pricing: { prompt: number; completion: number } | null }>; ok: boolean; reason?: string }`.

### [x] 1.2 RED — teste do handler
- Teste do novo comando no `index.ts` do engine: `models-list` emite `models-list-result` com a lista vazia quando o fetch falha (degradação graciosa, `ok: false` + `reason`).
- Teste: fetch bem-sucedido emite a lista parseada com `ok: true`.

### [x] 1.3 GREEN — fetch + cache
- Novo arquivo `engine/src/models.ts`: `fetchModelsList()` → `fetch("https://api.llmgateway.io/v1/models")` → parse da resposta JSON (usando o payload anexado no fim deste plano) → normaliza para `{ id, name, provider, pricing }`.
- Cache em memória (variável de módulo) — o fetch só acontece uma vez. O comando `models-list` retorna o cache se já populado.
- Degradação: timeout (30s), erro de rede, resposta inválida → emite `models-list-result` com `ok: false` + `reason` acionável — nunca lança.

---

## [x] Fase 2 — Seletor com busca na UI [🧠 Pro-Complex]

### [x] 2.1 RED — hook `useModelList`
- Hook `useModelList` que dispara `models-list` no engine e expõe `{ models, loading, error }`.
- Teste: estado inicial `loading: true`, depois `models: [...]` ao receber `models-list-result`.

### [x] 2.2 RED — componente `ModelSearchSelect`
- Componente controlado: campo de texto com drop-down pesquisável.
- Props: `value` (string atual), `onChange` (string), `models` (lista catalogada), `placeholder`.
- Comportamento: ao digitar, filtra a lista por `id`/`name` (case-insensitive); ao clicar num item, chama `onChange(item.id)`.
- Testes: renderiza, filtra ao digitar, seleciona item, tecla Escape fecha.

### [x] 2.3 GREEN — integrar no modal de modelos
- Cada linha do `ModelSettingsModal` ganha um `ModelSearchSelect` **junto** do campo de texto (não substituindo).
- Layout: `[label] [ModelSearchSelect (botão de busca)] [campo texto] [campo thinking]`.
- O botão de busca abre o drop-down; ao selecionar, preenche o campo de texto automaticamente.
- **Campo de texto livre mantido** — se o usuário digitar manualmente um modelo que não está na lista, o campo continua aceitando (fallback).

### [x] 2.4 GREEN — sync no boot
- `App.tsx`: ao montar (quando o engine conecta), dispara `models-list` automaticamente (via `useModelList`).
- O resultado fica disponível para todos os seletores (context ou prop drilling — manter simplicidade do protótipo, sem stores).

---

## [x] Fase 3 — Cálculo de custo em memória no engine [🧠 Pro-Complex]

### [x] 3.1 RED — helper `calculateCostFromPricing`
- Função pura `calculateCostFromPricing(tokens: { input: number; output: number }, pricing: { prompt: number; completion: number }): number` — aplica $/milhão de tokens.
- Teste: 1M tokens de input a $0.28/Mtok → $0.28; 500k output a $0.42/Mtok → $0.21; total $0.49.

### [x] 3.2 RED — cache de pricing por modelo no engine
- `getModelPricing(modelRef: string)` → consulta o cache populado pelo `models-list`. Retorna `null` se o modelo não está na lista (fallback: custo 0 + aviso na UI).
- Teste: modelo conhecido retorna pricing; modelo desconhecido retorna null.

### [x] 3.3 GREEN — emitir custo real no `agent-end`
- Em `agentRun` e `structured` (engine): após `safeStats(session)` (que obtém tokens do `getSessionStats()`), **sobrescrever** `stats.cost` com `calculateCostFromPricing(stats.tokens, pricing)` quando o pricing está disponível. Sem pricing → mantém o custo do SDK (provavelmente 0).
- O evento `agent-end` já carrega `stats.cost` — a UI não muda.
- Caminho mock (`mock.ts`): manter os valores fixos atuais (mock não consulta API real).

---

## [x] Fase 4 — Integração, validação e documentação [⚡ Flash]

- Atualizar `AGENTS.md` (seção "Configuração de modelos" e "Protocolo" — reabrir decisão #2: "campos manuais, sem dropdown" → "campos manuais **com seletor opcional**").
- Atualizar `ESCOPO.md` e `EPICS.md` (marcar E10).
- `pnpm test`, `pnpm build`, `pnpm engine:typecheck`, `pnpm engine:build`, `node engine/scripts/smoke.mjs`.
- Teste manual: abrir modal de modelos → clicar no seletor → buscar "deepseek" → selecionar modelo → campo preenchido → iniciar loop → custo aparece (não zero) no card de agente e no LoopTop.

---

## Fora de escopo

- **Auto-sync a cada loop** — o sync é só no boot do app (ou sob demanda via botão "Atualizar modelos"). Se um modelo for deprecado, o engine já degrada graciosamente (`applyModelBestEffort`).
- **Escrever `cost` no `~/.pi/agent/models.json`** (Fase D descartada) — risco de corromper o config do CLI `pi`. O custo é calculado **em memória** no engine e não persiste fora do app.
- **Pesquisa por provider** — a busca atual é por nome/id do modelo. Filtrar por provider é trivial (já está no schema) e pode ser adicionado depois.
- **Persistir a lista de modelos no localStorage** — a lista vive em cache de memória no engine (válido até o processo morrer). Em boot frio, o fetch é repetido.

## Riscos

- **Formato do `pricing` da API:** a resposta usa strings (`"prompt": "0.00000028"`), mas o SDK espera números ($/Mtok = $0.28). O parser precisa converter `parseFloat` com cuidado (não multiplicar ou dividir errado — o valor da API já é $/token, não $/Mtok). Validar com Zod + teste com snapshot da resposta real.
- **Modelos com múltiplos providers:** a API retorna `providers[]` cada um com seu `pricing`. Para MVP, usar o `top_provider` ou o primeiro da lista. Futuramente, expor escolha de provider no seletor.
- **Cache stale:** se o usuário deixar o app aberto por dias, a lista pode ficar desatualizada. Mitigação: botão "Atualizar modelos" no modal (fora do escopo da MVP, mas trivial de adicionar).
- **Timeout do fetch no boot:** atrasa o `ready` do engine. Mitigação: o fetch é assíncrono e não bloqueia o `ready` — o engine emite `ready` primeiro, depois `models-list-result` quando terminar (ou a UI envia `models-list` sob demanda).

---

## Resumo de Estimativas

| Fase | Complexidade | Estimativa |
|------|-------------|------------|
| Fase 1 | 🛠️ Pro-Standard | 3h |
| Fase 2 | 🧠 Pro-Complex | 5h |
| Fase 3 | 🧠 Pro-Complex | 4h |
| Fase 4 | ⚡ Flash | 1h |
| **Total** | | **~13h** |

Primeira Fase no Techlead: **Fase 1** (`[🛠️ Pro-Standard]`).

---

## Anexo — Payload de referência da API do llmgateway

```json
{
  "data": [
    {
      "id": "llmgateway/deepseek-v4-flash",
      "name": "DeepSeek V4 Flash",
      "display_name": "DeepSeek V4 Flash",
      "description": "Fast reasoning model by DeepSeek",
      "family": "deepseek",
      "top_provider": { "is_moderated": true },
      "providers": [
        {
          "providerId": "llmgateway",
          "externalId": "deepseek-v4-flash",
          "pricing": {
            "prompt": "0.00000028",
            "completion": "0.00000042",
            "input_cache_read": "0.000000028",
            "input_cache_write": "0.00000028"
          },
          "streaming": true,
          "tools": true,
          "reasoning": true,
          "max_output": 8192,
          "stability": "stable"
        }
      ],
      "pricing": {
        "prompt": "0.00000028",
        "completion": "0.00000042",
        "input_cache_read": "0.000000028",
        "input_cache_write": "0.00000028"
      },
      "context_length": 128000,
      "max_output": 8192,
      "stability": "stable"
    }
  ]
}
```

> **Atenção — unidade do `pricing`:** os valores vêm como **string em $/token** (ex.: `"0.00000028"` = $0.00000028 por token de prompt = **$0.28 por milhão de tokens**). O SDK espera `cost` em **$/milhão de tokens** (número). O parser deve: `parseFloat(pricing.prompt) * 1_000_000` → `0.28`.
