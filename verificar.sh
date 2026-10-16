#!/usr/bin/env bash
# Verificação completa do front: a unitária (verificar-unitario.sh) e a integrada
# (kampus/scripts/integrado.sh: Mongo local + seed + API do kampus-back + front + browser,
# fluxos reais e conferência dos prints de docs/antes). A integrada é obrigatória: precisa do
# kampus-back em ../kampus-back ou em KAMPUS_BACK_DIR, e falha se não o encontrar.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")" && pwd)"

"$RAIZ/verificar-unitario.sh"

KAMPUS_BACK_DIR="${KAMPUS_BACK_DIR:-$RAIZ/../kampus-back}"
if [ ! -d "$KAMPUS_BACK_DIR/m3-rest-api/project-management-server" ]; then
  echo "ERRO: kampus-back não encontrado em $KAMPUS_BACK_DIR." >&2
  echo "      Clonar o kampus-back ao lado deste repositório ou definir KAMPUS_BACK_DIR." >&2
  echo "      (Só a parte unitária: ./verificar-unitario.sh)" >&2
  exit 1
fi
echo "==> integrado (back em $KAMPUS_BACK_DIR)"
KAMPUS_BACK_DIR="$KAMPUS_BACK_DIR" "$RAIZ/kampus/scripts/integrado.sh"

# Só quando há repositório git; a verificação independente corre numa cópia sem .git
# e faz esta comparação por fora.
if git -C "$RAIZ" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "==> ficheiros versionados inalterados"
  git -C "$RAIZ" diff --exit-code --stat
else
  echo "==> sem .git: comparação de ficheiros versionados feita pela verificação externa"
fi

echo "OK"
