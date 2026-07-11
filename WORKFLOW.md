# 🚀 Workflow de Engenharia de Software Híbrido (Zed + Gemini GEM)

Este documento centraliza as diretrizes, a alocação de LLMs via **DevPass**, os comandos exatos de terminal e a dinâmica de contenção de erros para o desenvolvimento baseado em agentes atômicos.

---

## 🗺️ Distribuição Estratégica de LLMs (DevPass)

| Agente / Skill | Modelo Escolhido | Motivo Técnico |
| :--- | :--- | :--- |
| **💬 GEM Workspace** | `Gemini 3.1 Pro / 3.5 Thinking` | Custo fixo zero, janela de contexto gigante para discussões longas de escopo. |
| **🧠 /planejador** | `Grok 4.5` (Complexo) / `Kimi 2.7 Code` (Normal) | Visão arquitetural sênior e quebra impecável de lógica. |
| **🛠️ /techlead** | `Gemini 3.5 Flash` | Ultra-veloz, interpreta markdown perfeitamente e lida com leitura de pastas sem perda de contexto. |
| **💻 /coder** | `DeepSeek V4 Flash` | Focado em execução mecânica, submisso e extremamente barato por iteração de testes. |

---

## 🔄 Ciclo de Trabalho Atômico (Passo a Passo)

### Passo 1: O Alinhamento Macro (Pré-Issue)
Antes de tocar no código, abra o seu **GEM Arquiteto** no Gemini Workspace, envie a Issue crua do Linear + o seu `AGENTS.md` atual e passe pelo processo de sabatina (Modo Grill Me). Quando finalizado, o GEM gerará um resumo cirúrgico.

### Passo 2: O Início da Issue (Zed)
Copie o resumo gerado pelo GEM e dê a partida no `/planejador` para criar o `PLAN.md` na raiz do projeto.
```bash
/planejador Aqui está o contexto da Issue: [Texto mastigado gerado pelo GEM]
```

### Passo 3: A Delegação da Fase (Zed)
O Techlead deve orquestrar **APENAS UMA FASE** do `PLAN.md` por vez para evitar sobrecarga de contexto e alucinações. O comando deve injetar a pasta de contexto sugerida pelo GEM.
```bash
/techlead Leia a Fase X do PLAN.md e os arquivos da pasta 'src/[caminho_especificado_pelo_gem]/'
```

### Passo 4: A Execução Estrita (Zed)
Com o `TODO_BATCH.md` atômico gerado pelo Techlead na raiz, chame o executor usando estritamente o comando limpo, sem comandos redundantes textuais.
```bash
/coder run
```

---

## ⚠️ Protocolo de Crise e Fallback (Contenção de Danos)

O Coder está configurado para tentar consertar erros de linter ou testes do Jest no máximo **3 vezes**. 

1. **Se o Coder travar e estourar o limite:** Ele abortará a execução e exibirá `⚠️ Limite de tentativas atingido`.
2. **A Ação do Dev:** Não tente forçar o Coder. Pegue o log de erro do Jest, leve de volta para o chat do **GEM Workspace**.
3. **A Resolução:** O GEM (Arquiteto) avaliará se houve um furo no escopo do Techlead ou uma má interpretação arquitetural. Ajuste a instrução do Techlead com base na análise do GEM e gere um novo `TODO_BATCH.md`.

---

## 🎨 Celebração de Fase e Git Commit

Assim que o Coder marcar todas as tarefas com `[x]` e os testes rodarem com sucesso em 100%, informe a GEM Workspace. Ela gerará imediatamente o comando de commit semântico.
```bash
git commit -m "feat(modulo): mensagem semântica curta" -m "Conclui a Fase X do PLAN.md."
```
Em seguida, chame o `/techlead` novamente para virar a chave e fatiar a próxima fase do plano.

---

## 📝 Anexo: Prompt de Configuração da GEM (Workspace)

Crie um **GEM** no seu Gemini do Workspace e cole o conteúdo de `GEM.md`.
