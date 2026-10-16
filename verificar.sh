#!/usr/bin/env bash
# Verificação do front-end (app em kampus/): instala dependências, build, lint e testes.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")" && pwd)"
cd "$RAIZ/kampus"

echo "==> npm ci"
npm ci --no-audit --no-fund

echo "==> build"
npm run build

echo "==> lint"
# O script "lint" do projeto usa --max-warnings 0, mas o código de 2023 tem 9 avisos de
# react-hooks/exhaustive-deps; corrigi-los mudaria o comportamento. Aqui falha com
# qualquer erro e com qualquer aviso novo além desses 9.
npx eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 9

echo "==> testes"
npm test

# Verificação integrada (back + front + browser): precisa do kampus-back ao lado
# (ou KAMPUS_BACK_DIR) e do Chromium do Playwright. Sem o back, avisa e segue.
KAMPUS_BACK_DIR="${KAMPUS_BACK_DIR:-$RAIZ/../kampus-back}"
if [ -d "$KAMPUS_BACK_DIR/m3-rest-api/project-management-server" ]; then
  echo "==> integrado (back em $KAMPUS_BACK_DIR)"
  KAMPUS_BACK_DIR="$KAMPUS_BACK_DIR" ./scripts/integrado.sh
else
  echo "==> AVISO: kampus-back não encontrado em $KAMPUS_BACK_DIR; verificação integrada não corrida"
fi

# Só quando há repositório git; a verificação independente corre numa cópia sem .git
# e faz esta comparação por fora.
if git -C "$RAIZ" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "==> ficheiros versionados inalterados"
  git -C "$RAIZ" diff --exit-code --stat
else
  echo "==> sem .git: comparação de ficheiros versionados feita pela verificação externa"
fi

echo "OK"
