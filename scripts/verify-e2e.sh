#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación E2E del proceso (sobre eventflow_verify)
# Requiere: servidor `next start` en $BASE y BD sembrada con verify-ejemplo-e2e.sql
# ============================================================
set -uo pipefail
BASE="${BASE:-http://localhost:3939}"
PSQL="PGPASSWORD=postgres psql -h localhost -U postgres -d eventflow_verify -tAc"
EVENT="55555555-5555-5555-5555-555555555555"
QUOTE="66666666-6666-6666-6666-666666666666"
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
ko(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
q(){ eval "$PSQL \"$1\""; }
check(){ local d="$1" got="$2" exp="$3"; if [ "$got" = "$exp" ]; then ok "$d ($got)"; else ko "$d → got '$got', expected '$exp'"; fi; }

echo "═══ EventFlow · Verificación E2E del proceso ═══"

# ── 0. Login ────────────────────────────────────────────────
echo "▸ Login admin…"
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"verify123"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch{console.log('')}})")
[ -n "$TOKEN" ] && ok "token obtenido" || { ko "login falló"; exit 1; }
CK="-H Cookie:eventflow_token=$TOKEN"

# ── 1. Estado inicial ───────────────────────────────────────
echo "▸ Estado inicial del ejemplo…"
check "evento en borrador (draft)" "$(q "SELECT status FROM events WHERE id='$EVENT'")" "draft"
check "quote en sent"              "$(q "SELECT status FROM quotes WHERE id='$QUOTE'")" "sent"

# ── 2. FWD-2: aceptar presupuesto (señal) ───────────────────
echo "▸ FWD-2 · aceptar presupuesto (PUT /api/quotes/$QUOTE status=accepted)…"
RESP=$(curl -s -X PUT "$BASE/api/quotes/$QUOTE" $CK -H 'Content-Type: application/json' -d '{"status":"accepted"}')
echo "$RESP" | grep -qiE 'error|No autorizado' && ko "respuesta de aceptación: $RESP" || ok "aceptación aceptada por la API"

check "quote → accepted"            "$(q "SELECT status FROM quotes WHERE id='$QUOTE'")" "accepted"
check "evento → accepted"           "$(q "SELECT status FROM events WHERE id='$EVENT'")" "accepted"
check "event_order creado"          "$(q "SELECT count(*) FROM event_orders WHERE event_id='$EVENT'")" "1"
check "mesas sugeridas = 12"        "$(q "SELECT tables_suggested FROM event_orders WHERE event_id='$EVENT'")" "12"
check "camareros sugeridos = 16"    "$(q "SELECT waiters_suggested FROM event_orders WHERE event_id='$EVENT'")" "16"

# Pagos 40/60
check "2 pagos creados"             "$(q "SELECT count(*) FROM payments WHERE event_id='$EVENT'")" "2"
check "señal 40% = 1200"            "$(q "SELECT amount FROM payments WHERE event_id='$EVENT' AND amount=1200.00")" "1200.00"
check "saldo 60% = 1800"            "$(q "SELECT amount FROM payments WHERE event_id='$EVENT' AND amount=1800.00")" "1800.00"

# Staffing — camareros por fórmula FR-A05 (menú, 120 ⇒ 16)
check "staffing camareros = 16"     "$(q "SELECT slots_needed FROM staffing_lines WHERE event_id='$EVENT' AND role='camarero'")" "16"

# Escandallo (ingrediente único por id + coste teórico)
SHOP=$(q "SELECT count(*) FROM event_shopping_items WHERE event_id='$EVENT'")
[ "$SHOP" -ge 1 ] && ok "escandallo generado ($SHOP líneas)" || ko "escandallo vacío"
check "solomillo 200g×120 = 24000g" "$(q "SELECT total_grams FROM event_shopping_items WHERE event_id='$EVENT' AND ingredient_name='Solomillo VERIFY'")" "24000.00"
check "escandallo con ingredient_id" "$(q "SELECT bool_and(ingredient_id IS NOT NULL) FROM event_shopping_items WHERE event_id='$EVENT'")" "t"
check "coste teórico solomillo = 960" "$(q "SELECT estimated_cost FROM event_shopping_items WHERE event_id='$EVENT' AND ingredient_name='Solomillo VERIFY'")" "960.00"

# ── 3. Idempotencia de FWD-2 ────────────────────────────────
echo "▸ Idempotencia · re-aceptar no debe duplicar…"
curl -s -X PUT "$BASE/api/quotes/$QUOTE" $CK -H 'Content-Type: application/json' -d '{"status":"accepted"}' >/dev/null
check "sigue 1 event_order"         "$(q "SELECT count(*) FROM event_orders WHERE event_id='$EVENT'")" "1"
check "siguen 2 pagos"              "$(q "SELECT count(*) FROM payments WHERE event_id='$EVENT'")" "2"

# ── 4. Coste único (FR-S02): ingrediente sincronizado ───────
echo "▸ Coste único · trigger sync_ingredient_cost…"
check "unit_cost=cost_per_unit"     "$(q "SELECT (unit_cost=cost_per_unit AND unit_cost=current_price) FROM ingredients WHERE name='Solomillo VERIFY'")" "t"

# ── 5. FWD-4: cierre del evento ─────────────────────────────
echo "▸ FWD-4 · cierre (POST /api/events/$EVENT/close)…"
RESP=$(curl -s -X POST "$BASE/api/events/$EVENT/close" $CK -H 'Content-Type: application/json' -d '{}')
echo "$RESP" | grep -qiE '"error"|No autorizado' && ko "respuesta de cierre: $RESP" || ok "cierre aceptado por la API"
check "evento → completed"          "$(q "SELECT status FROM events WHERE id='$EVENT'")" "completed"
check "escandallo congelado"        "$(q "SELECT bool_and(frozen) FROM event_shopping_items WHERE event_id='$EVENT'")" "t"
check "stock deducido (flag)"       "$(q "SELECT stock_deducted FROM events WHERE id='$EVENT'")" "t"
# Stock real: 100000 g − 24000 g consumidos = 76000 g
check "stock solomillo = 76000"     "$(q "SELECT quantity FROM ingredients WHERE name='Solomillo VERIFY'")" "76000.00"
check "factura nº secuencial"       "$(q "SELECT invoice_number FROM invoices WHERE event_id='$EVENT'")" "F-$(date +%Y)-0001"
check "factura creada"              "$(q "SELECT count(*) FROM invoices WHERE event_id='$EVENT'")" "1"

# ── 6. Idempotencia de FWD-4 ────────────────────────────────
echo "▸ Idempotencia · re-cerrar no duplica factura…"
curl -s -X POST "$BASE/api/events/$EVENT/close" $CK -H 'Content-Type: application/json' -d '{}' >/dev/null
check "sigue 1 factura"             "$(q "SELECT count(*) FROM invoices WHERE event_id='$EVENT'")" "1"

echo "─────────────────────────────────────────────"
echo "RESULTADO:  $PASS OK  ·  $FAIL FALLOS"
[ "$FAIL" -eq 0 ] && echo "✅ El proceso completo se cumple correctamente." || echo "❌ Hay fallos que corregir."
exit "$FAIL"
