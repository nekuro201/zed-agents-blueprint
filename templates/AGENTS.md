# [PROJECT_NAME] — Agent Instructions

Use este arquivo como fonte da verdade absoluta para compreender a arquitetura e restrições deste repositório. O Techlead e o Coder devem seguir estas regras estritamente.

---

## Gerenciador de Pacotes e Infraestrutura

* Gerenciador: Utilize o [GERENCIADOR, ex: pnpm] exclusivamente. Nunca use outros gerenciadores.
* Lockfile: [LOCKFILE, ex: pnpm-lock.yaml]

### Comandos Principais
* Iniciar Dev: [COMANDO_START]
* Linter: [COMANDO_LINT]
* Testes: [COMANDO_TEST] (Jest/TDD)

---

## Arquitetura e Estrutura de Pastas

O repositório segue uma separação estrita baseada no padrão MVVM (Model-View-ViewModel).

```
src/
├── app/              # Rotas e entrypoints apenas. Sem lógica ou UI pesada.
├── shared/           # Camada Model: APIs, interfaces, services, hooks globais e stores.
├── viewModels/       # Funcionalidades isoladas (Módulos/Features).
│   └── FeatureName/
│       ├── FeatureName.view.tsx
│       ├── featureName.scheme.ts
│       └── useFeatureName.viewModel.tsx
└── styles/           # Tokens e estilos globais do sistema.
```

### Regras de Componentização e Importações
* Aliases de Caminho: Use estritamente o alias padrão (ex: `@/`) para caminhos internos. Importações relativas longas (ex: `../../`) são proibidas.
* UI Reutilizável: Componentes genéricos ficam em `src/shared/components/`. Eles devem ser apresentacionais puros ("dumb") e sem regras de negócio.
* Regra Anti-Loop de Barril: Quando um componente precisar de outro componente irmão situado na mesma pasta, ele deve importá-lo diretamente pelo arquivo específico (ex: `import { Button } from './Button'`) e nunca pelo index global da pasta mãe. Isso evita ciclos de carregamento inválidos (Require Cycles).

### Isolamento MVVM (Regra dos Dumb Components)
* Separação View/ViewModel: As Views (`.view.tsx`) são apenas apresentacionais. Elas nunca devem instanciar ou invocar o Hook do ViewModel internamente.
* Injeção via Props: A View deve receber todos os seus dados estruturados, estados e funções de callback estritamente através de Props.
* Papel do Container (Rota): O arquivo de rota dentro de `src/app/` atua como o orquestrador, chamando o Hook do ViewModel e injetando as propriedades diretamente na View (ex: `<FeatureView {...viewModelProps} />`).

---

## Regras de Negócio Críticas e Integrações

[Utilize esta seção para documentar integrações sensíveis, como Firebase, gateways de pagamento, ou regras core do domínio. Exemplo abaixo:]
* Fonte da Verdade: O [SERVIÇO/SDK] externo é a única fonte da verdade para dados de [CONTEXTO]. Nunca persista estados locais duplicados sem sincronização ativa.
* Tolerância a Falhas: Chamadas para SDKs de terceiros devem ser envelopadas em blocos try/catch seguros. Falhas nesses serviços não podem travar a inicialização do app ou fluxos básicos.

---

## Estilização e Testes (Qualidade)

* Padrão de Estilo: Use exclusivamente a engine utilitária do projeto (ex: Tailwind/className). Estilos inline complexos são proibidos.
* Classes Dinâmicas: É proibido usar interpolação de strings para construir nomes de classes utilitárias (ex: `text-${variante}`). Use objetos literais mapeados por extenso.
* Diretriz TDD First: Modificações em ViewModels ou Services exigem a criação ou atualização prévia dos testes unitários correspondentes (`.spec.ts` ou `.test.ts`).

---

## Restrições e Ferramental

* TypeScript Estrito: Configuração `strict: true` ativada. O uso do tipo `any` é terminantemente proibido.
* Variáveis Não Utilizadas: O repositório utiliza validações de pré-commit (Husky). Qualquer variável declarada e não utilizada bloqueará o commit. Remova códigos mortos.
* Variáveis de Ambiente: Segredos e chaves de API devem ser injetados exclusivamente via arquivos `.env` locais (gitignored). Nunca insira tokens diretamente no código-fonte.

---

## Em Caso de Dúvidas
* Consulte o `package.json` para validar a versão dos scripts ou fale com o Arquiteto no chat externo antes de forçar modificações em arquivos de configuração global (`tsconfig.json`, `metro.config.js`, etc.).
```
