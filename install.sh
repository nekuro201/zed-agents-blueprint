#!/bin/bash
# install.sh - Execute de dentro do seu novo projeto apontando para este blueprint

TARGET_DIR=$(pwd)
BLUEPRINT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "🚚 Injetando ecossistema de agentes no projeto atual..."

# Copia a documentação de fluxo
cp "$BLUEPRINT_DIR/WORKFLOW.md" "$TARGET_DIR/"

# Cria os templates base se não existirem
if [ ! -f "$TARGET_DIR/AGENTS.md" ]; then
    cp "$BLUEPRINT_DIR/templates/AGENTS.md" "$TARGET_DIR/"
    echo "✅ AGENTS.md criado! (Lembre-se de preencher as stacks do projeto)"
fi

echo "🚀 Pronto! Abra o Zed e configure as skills usando os prompts da pasta /skills."
