#!/usr/bin/env bash
# Verificação integrada: back (kampus-back) + MongoDB local + seed + front, e depois
# os fluxos reais (fluxos.mjs) e os prints (prints.mjs) num browser.
# Uso: KAMPUS_BACK_DIR=/caminho/para/kampus-back scripts/integrado.sh
# PRINTS_DIR=pasta guarda os prints nessa pasta (por omissão vão para uma pasta temporária).
# Usa portas próprias (Mongo 27117, API 5105, front 5173: o CORS do back de 2023 só aceita localhost:5173 nos preflights) e uma pasta de dados temporária.
set -euo pipefail

FRONT="$(cd "$(dirname "$0")/.." && pwd)"
BACK="$(cd "${KAMPUS_BACK_DIR:?indicar KAMPUS_BACK_DIR}" && pwd)/m3-rest-api/project-management-server"
TMP="$(mktemp -d)"
PIDS=()

limpar() {
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  rm -rf "$TMP"
}
trap limpar EXIT

esperar() { # url, segundos
  for _ in $(seq 1 "$2"); do curl -s -o /dev/null "$1" && return 0; sleep 1; done
  echo "Não respondeu: $1" >&2; return 1
}

export MONGO_PORT=27117
export MONGO_DBPATH="$TMP/mongo"
export MONGODB_URI="mongodb://127.0.0.1:$MONGO_PORT/kampus-integrado"
export TOKEN_SECRET="segredo-falso-$RANDOM-$RANDOM"
export PORT=5105
export ORIGIN="http://localhost:5173"
export VITE_API_URL="http://localhost:$PORT"
export API_URL="$VITE_API_URL"
export BASE_URL="http://localhost:5173"
# Data fixa para o seed e para o relógio do browser: prints reprodutíveis, comparáveis pixel a pixel.
export SEED_DATE="2023-11-20T10:00:00Z"
export PRINTS_DATE="$SEED_DATE"

echo "==> back: dependências"
(cd "$BACK" && npm ci --no-audit --no-fund >/dev/null)

echo "==> MongoDB local"
(cd "$BACK" && exec node scripts/db-local.js) > "$TMP/db.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 120); do grep -q "MongoDB local em" "$TMP/db.log" && break; sleep 1; done
grep -q "MongoDB local em" "$TMP/db.log" || { cat "$TMP/db.log"; exit 1; }

echo "==> seed"
(cd "$BACK" && node scripts/seed.js)

echo "==> API"
(cd "$BACK" && exec node server.js) > "$TMP/back.log" 2>&1 &
PIDS+=($!)
esperar "$API_URL/api" 30

echo "==> front"
(cd "$FRONT" && exec node node_modules/vite/bin/vite.js --port 5173 --strictPort) > "$TMP/front.log" 2>&1 &
PIDS+=($!)
esperar "$BASE_URL" 60

PRINTS="${PRINTS_DIR:-$TMP/prints}"
echo "==> prints em $PRINTS"
(cd "$FRONT" && node scripts/prints.mjs "$PRINTS")
diff <(ls "$PRINTS") <(ls "$FRONT/../docs/antes") \
  || { echo "Os prints gerados não têm os mesmos nomes que docs/antes" >&2; exit 1; }

echo "==> conferência de docs/antes (PNG válidos, dimensões, não vazios, iguais aos gerados)"
(cd "$FRONT" && node scripts/conferir-prints.mjs "$PRINTS")

echo "==> fluxos de ponta a ponta"
(cd "$FRONT" && node scripts/fluxos.mjs)

echo "==> a API continua de pé"
curl -sf "$API_URL/api" >/dev/null
echo "Integrado OK"
