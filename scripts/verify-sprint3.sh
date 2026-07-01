#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación Sprint 3 · Trazabilidad (G5) y Contrato/firma (G8)
# G5: consumo FEFO automático al cierre (lot_consumption/traceability_log).
# G8: contrato de cliente generado bajo demanda + firma dibujada (canvas).
#
# Uso:  BASE=http://localhost:3939 bash scripts/verify-sprint3.sh
# Resiembra eventflow_verify (schema.sql + verify-ejemplo-e2e.sql).
# ============================================================
set -uo pipefail
BASE="${BASE:-http://localhost:3939}"
PGURL_ADMIN="PGPASSWORD=postgres psql -h localhost -U postgres"
PSQL="PGPASSWORD=postgres psql -h localhost -U postgres -d eventflow_verify -tAc"
EVENT="55555555-5555-5555-5555-555555555555"
QUOTE="66666666-6666-6666-6666-666666666666"
SOLOMILLO="11111111-1111-1111-1111-111111111111"
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
ko(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
q(){ eval "$PSQL \"$1\""; }
check(){ local d="$1" got="$2" exp="$3"; if [ "$got" = "$exp" ]; then ok "$d ($got)"; else ko "$d → got '$got', expected '$exp'"; fi; }
jget(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j.'+process.argv[1]))}catch(e){console.log('ERR')}})" "$1"; }

echo "═══ EventFlow · Sprint 3 · Trazabilidad (G5) + Contrato (G8) ═══"

# ── 0. Resembrar BD ──────────────────────────────────────────
echo "▸ Resembrando eventflow_verify…"
eval "$PGURL_ADMIN -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='eventflow_verify' AND pid<>pg_backend_pid();\"" >/dev/null 2>&1
eval "$PGURL_ADMIN -c 'DROP DATABASE IF EXISTS eventflow_verify;'" >/dev/null 2>&1
eval "$PGURL_ADMIN -c 'CREATE DATABASE eventflow_verify;'" >/dev/null 2>&1
eval "$PGURL_ADMIN -d eventflow_verify -v ON_ERROR_STOP=1 -f schema.sql" >/dev/null 2>&1 && ok "schema.sql cargado" || ko "fallo cargando schema.sql"
eval "$PGURL_ADMIN -d eventflow_verify -v ON_ERROR_STOP=1 -f scripts/verify-ejemplo-e2e.sql" >/dev/null 2>&1 && ok "fixture sembrado" || ko "fallo sembrando fixture"

TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"verify123"}' | jget 'token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "ERR" ] && ok "admin login" || { ko "login"; exit 1; }
AC="-H Cookie:eventflow_token=$TOKEN"

# ════════════════════════════════════════════════════════════
# G5 · Trazabilidad FEFO al cierre
# ════════════════════════════════════════════════════════════
echo "▸ G5 · registrar 2 lotes con caducidades distintas (10000g + 8000g = 18000g < demanda 24000g)…"
curl -s -X POST "$BASE/api/trazabilidad/receiving" $AC -H 'Content-Type: application/json' \
  -d "{\"ingredient_id\":\"$SOLOMILLO\",\"lot_number\":\"LOTE-A\",\"batch_quantity\":10000,\"unit\":\"g\",\"supplier\":\"Prov VERIFY\",\"expiry_date\":\"$(date -d '+5 days' +%F 2>/dev/null || date -v+5d +%F)\"}" >/dev/null
curl -s -X POST "$BASE/api/trazabilidad/receiving" $AC -H 'Content-Type: application/json' \
  -d "{\"ingredient_id\":\"$SOLOMILLO\",\"lot_number\":\"LOTE-B\",\"batch_quantity\":8000,\"unit\":\"g\",\"supplier\":\"Prov VERIFY\",\"expiry_date\":\"$(date -d '+30 days' +%F 2>/dev/null || date -v+30d +%F)\"}" >/dev/null
check "lotes registrados (2)" "$(q "SELECT count(*) FROM receiving_log WHERE ingredient_id='$SOLOMILLO'")" "2"
check "stock tras recepción = 118000" "$(q "SELECT quantity::int FROM ingredients WHERE id='$SOLOMILLO'")" "118000"

echo "▸ G5 · aceptar y cerrar el evento (demanda 24000g = 120×200g)…"
curl -s -X POST "$BASE/api/quotes/public/$QUOTE/accept" -H 'Content-Type: application/json' >/dev/null
CLOSE=$(curl -s -X POST "$BASE/api/events/$EVENT/close" $AC -H 'Content-Type: application/json' -d '{}')
echo "$CLOSE" | grep -qi '"success":true' && ok "cierre aceptado" || ko "cierre: $CLOSE"

check "AC-G5.1/G5.2 · FEFO consume LOTE-A primero (agotado, 10000)" \
  "$(q "SELECT quantity_consumed FROM lot_consumption lc JOIN receiving_log rl ON rl.id=lc.receiving_log_id WHERE rl.lot_number='LOTE-A'")" "10000.000"
check "AC-G5.2 · cruza a LOTE-B (agotado, 8000)" \
  "$(q "SELECT quantity_consumed FROM lot_consumption lc JOIN receiving_log rl ON rl.id=lc.receiving_log_id WHERE rl.lot_number='LOTE-B'")" "8000.000"
check "AC-G5.2 · 2 filas en lot_consumption (no se inventa una 3ª)" "$(q "SELECT count(*) FROM lot_consumption WHERE event_id='$EVENT'")" "2"
check "AC-G5.4 · traceability_log alimentado (2 filas)" "$(q "SELECT count(*) FROM traceability_log WHERE event_id='$EVENT'")" "2"
echo "$CLOSE" | grep -qi "Trazabilidad" && ok "AC-G5.3 · traceGap reportado en /close (6000g sin lote)" || ko "AC-G5.3 · /close no reportó el hueco de trazabilidad: $CLOSE"

echo "▸ G5 · idempotencia (reintentar cierre no duplica)…"
curl -s -X POST "$BASE/api/events/$EVENT/close" $AC -H 'Content-Type: application/json' >/dev/null
check "AC-G5.5 · sigue habiendo 2 filas en lot_consumption" "$(q "SELECT count(*) FROM lot_consumption WHERE event_id='$EVENT'")" "2"

# ── Resultado ────────────────────────────────────────────────
echo "─────────────────────────────────────────────"
echo "RESULTADO:  $PASS OK  ·  $FAIL FALLOS"
[ "$FAIL" -eq 0 ] && echo "✅ Sprint 3 verificado (hasta ahora)." || echo "❌ Hay fallos."
[ "$FAIL" -eq 0 ]
