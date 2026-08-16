import { execSync } from 'child_process';
import fs from 'fs';

const MAX_TENTATIVAS_ERRO = 3;

// Roda o comando no terminal mostrando na tela
function rodarComando(comando) {
    console.log(`\n🚀 Executando: ${comando}`);
    execSync(comando, { stdio: 'inherit' });
}

// Roda silenciosamente e captura a resposta do LLM
function lerComando(comando) {
    try {
        return execSync(comando, { stdio: 'pipe' }).toString().trim();
    } catch (error) {
        return error.stdout?.toString().trim() + "\n" + error.stderr?.toString().trim();
    }
}

// 🧠 AGENTE LEITOR: Descobre dinamicamente qual a próxima fase
function obterProximaFase() {
    console.log("\n🔍 Lendo PLAN.md para encontrar a próxima fase...");

    const prompt = `Leia o arquivo PLAN.md. Identifique qual é a PRIMEIRA fase que ainda NÃO foi concluída (não está com [x] ou 'concluído'). Responda APENAS com o nome curto da fase, ex: "Fase 1" ou "Fase 2". Se todas as fases estiverem concluídas, responda APENAS a palavra: "CONCLUIDO". Sem explicações.`;

    // O "-p" garante que o Pi não fique travado esperando input
    const resposta = lerComando(`pi -p --model llmgateway/deepseek-v4-flash "${prompt}"`);

    if (resposta.includes('CONCLUIDO')) return null;

    // Limpa eventuais aspas ou marcações markdown (ex: **Fase 1**)
    return resposta.replace(/[\*"']/g, "").trim();
}

// 🧠 AGENTE ATUALIZADOR: Marca a fase como concluída no PLAN.md
function marcarFaseConcluida(fase) {
    console.log(`\n📝 Atualizando PLAN.md: Marcando ${fase} como concluída...`);
    rodarComando(`pi -p --model llmgateway/deepseek-v4-flash "No arquivo PLAN.md, encontre a ${fase} e marque-a explicitamente como concluída (mudando de [ ] para [x] ou atualizando o status da tabela). Apenas edite o arquivo e encerre."`);
}

// 🧠 JUIZ DE TDD: Avalia se o erro do Jest é o esperado
function avaliarErroTDD() {
    console.log("⚖️ [QA Agent] Avaliando erro do Jest...");

    const promptQA = `
        Leia o arquivo 'error.log' e o 'TODO_BATCH.md'.
        Estamos usando TDD. Se o erro for puramente um teste falhando porque o código ainda não foi implementado, responda APENAS: ESPERADO.
        Se for erro de sintaxe, tipagem, crash de módulo ou teste falhando quando já deveria passar, responda APENAS: INESPERADO.
    `;

    const resposta = lerComando(`pi -p --model llmgateway/deepseek-v4-flash "${promptQA}"`);
    return resposta.includes('ESPERADO') ? 'ESPERADO' : 'INESPERADO';
}

// 🔥 O MOTOR PRINCIPAL 🔥
function iniciarLoopAutonomo() {
    console.log("🔥 INICIANDO FÁBRICA DE SOFTWARE AUTÔNOMA 🔥");

    while (true) {
        // 1. DESCOBRE A FASE ATUAL
        const faseAtual = obterProximaFase();

        if (!faseAtual) {
            console.log("\n🎉 TODAS AS FASES CONCLUÍDAS! PROJETO FINALIZADO!");
            break; // Sai do loop infinito
        }

        console.log(`\n==================================================`);
        console.log(`🎯 INICIANDO: ${faseAtual}`);
        console.log(`==================================================`);

        // 2. CHAMA O TECHLEAD PARA FATIAR
        rodarComando(`pi -p --model llmgateway/deepseek-v4-flash "/techlead Leia a ${faseAtual} do PLAN.md e gere o TODO_BATCH.md correspondente a ela."`);

        let sucessoFase = false;
        let tentativaCoder = 1;

        // 3. O LOOP DO CODER E TESTES
        while (tentativaCoder <= MAX_TENTATIVAS_ERRO && !sucessoFase) {
            console.log(`\n💻 [Tentativa ${tentativaCoder}/${MAX_TENTATIVAS_ERRO}] Coder executando lote...`);

            const instrucaoCoder = tentativaCoder === 1
                ? "/coder Cumpra rigorosamente as tarefas do TODO_BATCH.md"
                : "/coder O último teste falhou. Leia 'error.log' e conserte a implementação.";

            rodarComando(`pi -p --model llmgateway/deepseek-v4-flash "${instrucaoCoder}"`);

            try {
                console.log("🧪 Rodando testes (npm run test)...");
                execSync('npm run test', { stdio: 'pipe' });

                console.log(`✅ Testes Verdes! ${faseAtual} concluída com sucesso.`);
                sucessoFase = true;

            } catch (error) {
                const logErro = error.stdout?.toString() + "\n" + error.stderr?.toString();
                fs.writeFileSync('error.log', logErro || "Erro desconhecido no Jest");
                console.log("❌ Testes falharam. Log salvo em 'error.log'.");

                const julgamento = avaliarErroTDD();
                console.log(`🔎 Veredito do QA: Erro ${julgamento}`);

                if (julgamento === 'ESPERADO') {
                    console.log("⏭️ Erro TDD esperado. O Coder continuará o lote...");
                    continue; // Avança o loop sem queimar vida
                } else {
                    console.log("⚠️ Erro INESPERADO. O Coder tentará corrigir (perdeu uma tentativa).");
                    tentativaCoder++;
                }
            }
        }

        // 4. VERIFICA SE A FASE FOI UM SUCESSO OU UM FRACASSO
        if (sucessoFase) {
            // Marca a Fase como concluída para que no próximo loop ele pegue a Fase 2!
            marcarFaseConcluida(faseAtual);

            // Realiza um Commit Automático
            console.log(`\n📦 Git Commit automático da ${faseAtual}...`);
            try {
                execSync('git add .', { stdio: 'pipe' });
                execSync(`git commit -m "feat: conclui ${faseAtual} (via agente)"`, { stdio: 'pipe' });
            } catch(e) {
                console.log("Commit ignorado (sem alterações ou git não iniciado).");
            }

            console.log(`\n🔄 Preparando para avançar para a próxima fase...`);

        } else {
            // PROTOCOLO DE CRISE - ESTOURO DE 3 TENTATIVAS
            console.log(`\n🚨 PROTOCOLO DE CRISE: O Coder falhou 3 vezes seguidas na ${faseAtual}.`);

            const promptCrise = `
                /techlead O Coder falhou em passar os testes na ${faseAtual}.
                Leia o 'error.log' e reavalie. Reescreva o 'TODO_BATCH.md' com uma estratégia técnica mais fácil ou corrigindo o teste quebrado.
            `;

            // Chama o modelo Sênior para desatar o nó
            rodarComando(`pi -p --model llmgateway/grok-4-5 "${promptCrise}"`);

            console.log("🛑 O Techlead gerou um novo plano de ação. Script pausado para revisão humana.");
            break; // Quebra o script. Você audita o código e roda "node automacao.js" de novo.
        }
    }
}

iniciarLoopAutonomo();
