#!/bin/bash
# install.sh - Executar de dentro do novo projeto apontando para este blueprint

TARGET_DIR=$(pwd)
BLUEPRINT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "Iniciando injecao do ecossistema de agentes no projeto atual..."

# Garante a existencia da pasta docs e copia/sobrescreve o WORKFLOW.md
mkdir -p "$TARGET_DIR/docs"
cp -f "$BLUEPRINT_DIR/WORKFLOW.md" "$TARGET_DIR/docs/"
echo "WORKFLOW.md atualizado em docs/"

# Garante a existencia da pasta oculta .agents e copia/sobrescreve as definicoes dos agentes
mkdir -p "$TARGET_DIR/.agents"
cp -rf "$BLUEPRINT_DIR/skills/"* "$TARGET_DIR/.agents/"
echo "Skills locais atualizadas em .agents/"

# Cria o template base do AGENTS.md apenas se ele nao existir (nunca sobrescreve)
if [ ! -f "$TARGET_DIR/AGENTS.md" ]; then
    cp "$BLUEPRINT_DIR/templates/AGENTS.md" "$TARGET_DIR/"
    echo "AGENTS.md criado na raiz. Defina as stacks do seu projeto."
else
    echo "AGENTS.md ja existente na raiz. Ignorando copia para preservar dados locais."
fi

echo "Setup concluido. Ajuste o AGENTS.md e configure as skills locais no editor Zed apontando para .agents/"
