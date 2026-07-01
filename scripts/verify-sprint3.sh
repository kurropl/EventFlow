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

# ════════════════════════════════════════════════════════════
# G8 · Contrato y firma de cliente (D2 firma dibujada, D3 botón separado)
# ════════════════════════════════════════════════════════════
echo "▸ G8 · el contrato NO se genera automáticamente al aceptar (D3)…"
check "AC-G8.2 · event_contracts vacío antes de generar" "$(q "SELECT count(*) FROM event_contracts WHERE event_id='$EVENT'")" "0"

echo "▸ G8 · generación bajo demanda…"
GEN1=$(curl -s -X POST "$BASE/api/events/$EVENT/contract/generate" $AC)
echo "$GEN1" | grep -qi '"success":true' && ok "AC-G8.1 · contrato generado" || ko "generate: $GEN1"
check "AC-G8.1 · 1 fila pending" "$(q "SELECT status FROM event_contracts WHERE event_id='$EVENT'")" "pending"

GEN2=$(curl -s -X POST "$BASE/api/events/$EVENT/contract/generate" $AC)
check "AC-G8.3 · idempotente (sigue 1 fila)" "$(q "SELECT count(*) FROM event_contracts WHERE event_id='$EVENT'")" "1"

echo "▸ G8 · sin client_token (evento no aceptado) → 400…"
DRAFT_EV="57777777-7777-7777-7777-777777777777"
q "INSERT INTO events (id,client_name,client_email,event_type,guest_count,event_date,status)
   VALUES ('$DRAFT_EV','Cliente Draft','draft@t.test','boda',10,(now()+interval '100 days')::date,'draft') ON CONFLICT (id) DO NOTHING" >/dev/null
CODE_NOTOKEN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/events/$DRAFT_EV/contract/generate" $AC)
check "AC-G8.4 · evento sin client_token → 400" "$CODE_NOTOKEN" "400"

echo "▸ G8 · acceso público por token…"
CTOKEN=$(q "SELECT client_token FROM events WHERE id='$EVENT'")
PUB=$(curl -s "$BASE/api/contract/public/$CTOKEN")
echo "$PUB" | grep -qi '"success":true' && ok "AC-G8.5 · GET público 200" || ko "public GET: $PUB"
check "AC-G8.5 · status pending" "$(echo "$PUB" | jget 'data.status')" "pending"
CODE_BADTOKEN=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/contract/public/token-invalido-xyz")
check "AC-G8.6 · token inválido → 404" "$CODE_BADTOKEN" "404"

echo "▸ G8 · firma en blanco rechazada…"
BLANK=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/contract/public/$CTOKEN/sign" \
  -H 'Content-Type: application/json' -d '{"signed_by_name":"X","signed_by_nif":"1","signature_data":"data:image/png;base64,short"}')
check "AC-G8.8 · signature_data corto → 422" "$BLANK" "422"
check "AC-G8.8 · sigue pending (no se marcó firmado)" "$(q "SELECT status FROM event_contracts WHERE event_id='$EVENT'")" "pending"

echo "▸ G8 · firma correcta (signature_data simulado, la pizarra real se probó en navegador)…"
FAKESIG="data:image/png;base64,$(node -e "console.log('A'.repeat(600))")"
SIGN=$(curl -s -X POST "$BASE/api/contract/public/$CTOKEN/sign" -H 'Content-Type: application/json' \
  -d "{\"signed_by_name\":\"Cliente VERIFY\",\"signed_by_nif\":\"12345678A\",\"signature_data\":\"$FAKESIG\"}")
echo "$SIGN" | grep -qi '"success":true' && ok "AC-G8.7 · firma aceptada" || ko "sign: $SIGN"
check "AC-G8.7 · status signed" "$(q "SELECT status FROM event_contracts WHERE event_id='$EVENT'")" "signed"
check "AC-G8.7 · signed_by_name persistido" "$(q "SELECT signed_by_name FROM event_contracts WHERE event_id='$EVENT'")" "Cliente VERIFY"
check "AC-G8.7 · signer_ip capturado (no vacío)" "$(q "SELECT (signer_ip IS NOT NULL) FROM event_contracts WHERE event_id='$EVENT'")" "t"

echo "▸ G8 · firmar dos veces → 409…"
CODE_TWICE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/contract/public/$CTOKEN/sign" -H 'Content-Type: application/json' \
  -d "{\"signed_by_name\":\"Otro\",\"signed_by_nif\":\"00000000X\",\"signature_data\":\"$FAKESIG\"}")
check "AC-G8.9 · segunda firma → 409" "$CODE_TWICE" "409"
check "AC-G8.9 · signed_by_name NO se sobrescribió" "$(q "SELECT signed_by_name FROM event_contracts WHERE event_id='$EVENT'")" "Cliente VERIFY"

echo "▸ G8 · admin ve el contrato…"
ADMIN_GET=$(curl -s "$BASE/api/events/$EVENT/contract" $AC)
check "AC-G8.10 · admin GET 200 con status signed" "$(echo "$ADMIN_GET" | jget 'data.status')" "signed"

echo "▸ G8 · anular y regenerar…"
VOID=$(curl -s -X POST "$BASE/api/events/$EVENT/contract/void" $AC -H 'Content-Type: application/json' -d '{"reason":"test anular"}')
check "AC-G8.11 · anulado" "$(echo "$VOID" | jget 'data.status')" "voided"
GEN3=$(curl -s -X POST "$BASE/api/events/$EVENT/contract/generate" $AC)
check "AC-G8.11 · nuevo contrato pending tras anular" "$(echo "$GEN3" | jget 'data.status')" "pending"
check "AC-G8.11 · 2 filas en total (1 voided + 1 pending)" "$(q "SELECT count(*) FROM event_contracts WHERE event_id='$EVENT'")" "2"

# ── Resultado ────────────────────────────────────────────────
echo "─────────────────────────────────────────────"
echo "RESULTADO:  $PASS OK  ·  $FAIL FALLOS"
[ "$FAIL" -eq 0 ] && echo "✅ Sprint 3 verificado (hasta ahora)." || echo "❌ Hay fallos."
[ "$FAIL" -eq 0 ]
