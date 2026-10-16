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

echo "==> ficheiros versionados inalterados"
git -C "$RAIZ" diff --exit-code --stat

echo "OK"
