#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación Sprint 2 · Inventario (G2 + G6)
# G2: compromiso de inventario al aceptar + compra automática (borrador) +
#     bloqueo opcional (E1).
# G6: ledger único de stock (ingredients.quantity canónico, inventory espejo).
#
# Uso:  BASE=http://localhost:3939 bash scripts/verify-sprint2.sh
# Resiembra eventflow_verify (schema.sql + verify-ejemplo-e2e.sql).
# ============================================================
set -uo pipefail
BASE="${BASE:-http://localhost:3939}"
PGURL_ADMIN="PGPASSWORD=postgres psql -h localhost -U postgres"
PSQL="PGPASSWORD=postgres psql -h localhost -U postgres -d eventflow_verify -tAc"
EVENT="55555555-5555-5555-5555-555555555555"
QUOTE="66666666-6666-6666-6666-666666666666"
SOLOMILLO="11111111-1111-1111-1111-111111111111"
EV2="52222222-2222-2222-2222-222222222222"
Q2="62222222-2222-2222-2222-222222222222"
EV3="53333333-3333-3333-3333-333333333333"
Q3="63333333-3333-3333-3333-333333333333"
EV4="54444444-4444-4444-4444-444444444444"
Q4="64444444-4444-4444-4444-444444444444"
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
ko(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
q(){ eval "$PSQL \"$1\""; }
check(){ local d="$1" got="$2" exp="$3"; if [ "$got" = "$exp" ]; then ok "$d ($got)"; else ko "$d → got '$got', expected '$exp'"; fi; }
jget(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j.'+process.argv[1]))}catch(e){console.log('ERR')}})" "$1"; }
# Crea evento+quote pidiendo `qty` raciones de "Solomillo VERIFY" (evita JSON
# literal con comillas anidadas — que se rompe al pasar por el eval doble de
# q() — construyendo el jsonb con funciones SQL, solo comillas simples).
mkevent(){
  local eid="$1" qid="$2" name="$3" email="$4" guests="$5" days="$6" pvp="$7" cost="$8"
  q "INSERT INTO events (id,client_name,client_email,event_type,guest_count,event_date,status,service_type,selected_items,total_pvp,total_cost,iva_pct)
     VALUES ('$eid','$name','$email','boda',$guests,(now()+interval '$days days')::date,'draft','menu',
     jsonb_build_array(jsonb_build_object('name','Solomillo VERIFY','quantity',$guests,'pvp',25,'cost',8)),
     $pvp,0.00,10)" >/dev/null
  q "INSERT INTO quotes (id,event_id,status,items,base_pvp,base_cost,total_pvp,total_cost,iva_pct)
     VALUES ('$qid','$eid','sent',
     jsonb_build_array(jsonb_build_object('name','Solomillo VERIFY','quantity',$guests,'pvp',25,'cost',8)),
     $pvp,$cost,$pvp,$cost,10)" >/dev/null
  q "UPDATE events SET quote_id='$qid' WHERE id='$eid'" >/dev/null
}

echo "═══ EventFlow · Sprint 2 · Inventario (G2 + G6) ═══"

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
# G6 · convert_uom + ledger único
# ════════════════════════════════════════════════════════════
echo "▸ G6 · convert_uom (bug fix) y ledger único…"
check "AC-G2.1 · convert_uom(2000,g,kg) = 2" "$(q "SELECT convert_uom(2000,'g','kg')")" "2.0000"
check "G6 · espejo inventory existe para Solomillo VERIFY" "$(q "SELECT count(*) FROM inventory WHERE ingredient_id='$SOLOMILLO'")" "1"
check "G6 · inventory.quantity = ingredients.quantity (backfill)" "$(q "SELECT quantity FROM inventory WHERE ingredient_id='$SOLOMILLO'")" "100000.000"

# ════════════════════════════════════════════════════════════
# G2 · Aceptar sin conflicto (fixture, stock sobrado)
# ════════════════════════════════════════════════════════════
echo "▸ G2 · aceptar sin faltante de stock…"
RESP=$(curl -s -X POST "$BASE/api/quotes/public/$QUOTE/accept" -H 'Content-Type: application/json')
echo "$RESP" | grep -qi '"success":true' && ok "AC-G2.2 · acepta sin faltante (200)" || ko "respuesta: $RESP"
check "AC-G2.3 · compromiso registrado (1 fila)" "$(q "SELECT count(*) FROM inventory_commitments WHERE event_id='$EVENT' AND ingredient_id='$SOLOMILLO'")" "1"
check "AC-G2.3 · qty_committed = 24000 (120×200g)" "$(q "SELECT qty_committed FROM inventory_commitments WHERE event_id='$EVENT' AND ingredient_id='$SOLOMILLO'")" "24000.000"

# Re-aceptar (idempotente) vía PUT directo a quotes/[id] (acceptQuote no-op)
R2=$(curl -s -X PUT "$BASE/api/quotes/$QUOTE" $AC -H 'Content-Type: application/json' -d '{"status":"accepted"}')
SW=$(echo "$R2" | jget 'stockWarnings.length')
check "AC-G2.7 · stockWarnings en la respuesta de quotes PUT (array)" "$SW" "0"
check "AC-G2.8 · re-aceptar no duplica el compromiso" "$(q "SELECT count(*) FROM inventory_commitments WHERE event_id='$EVENT' AND ingredient_id='$SOLOMILLO'")" "1"

# ════════════════════════════════════════════════════════════
# G2 · Segundo evento disputa el mismo stock → aviso + pedido borrador
# ════════════════════════════════════════════════════════════
echo "▸ G2 · segundo evento agota el stock ya comprometido…"
mkevent "$EV2" "$Q2" "Cliente DOS" "dos@t.test" 400 70 10000.00 3200.00

# 400 raciones × 200g = 80000g necesarios; disponible = 100000 - 24000(evento1) = 76000g → déficit 4000g
RESP2=$(curl -s -X PUT "$BASE/api/quotes/$Q2" $AC -H 'Content-Type: application/json' -d '{"status":"accepted"}')
CODE2=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/quotes/$Q2" $AC -H 'Content-Type: application/json' -d '{"status":"accepted"}')
check "AC-G2.5 · aceptación NO bloqueada (200, no bloqueante por defecto)" "$CODE2" "200"
check "evento 2 → accepted" "$(q "SELECT status FROM events WHERE id='$EV2'")" "accepted"
SW2=$(echo "$RESP2" | jget 'stockWarnings.length')
[ "${SW2:-0}" -ge 1 ] 2>/dev/null && ok "AC-G2.4 · stockWarnings detecta el conflicto (≥1)" || ko "AC-G2.4 → stockWarnings.length=$SW2"
DEFICIT=$(echo "$RESP2" | jget "stockWarnings[0].deficit")
check "AC-G2.4 · déficit = 4000 (80000−76000)" "$DEFICIT" "4000"

check "AC-G2.6 · pedido borrador auto-generado (1)" "$(q "SELECT count(*) FROM supplier_orders WHERE event_id='$EV2' AND origin='auto_accept' AND status='pending'")" "1"
ITEMQTY=$(q "SELECT soi.quantity FROM supplier_order_items soi JOIN supplier_orders so ON so.id=soi.order_id WHERE so.event_id='$EV2' AND so.origin='auto_accept'")
check "AC-G2.6 · línea del pedido = 4000" "$ITEMQTY" "4000.000"

# ════════════════════════════════════════════════════════════
# G2 · Liberación de compromisos (revertir / cancelar / cerrar)
# ════════════════════════════════════════════════════════════
echo "▸ G2 · liberación de compromisos…"
curl -s -X POST "$BASE/api/events/$EV2/transitions" $AC -H 'Content-Type: application/json' -d '{"transition":"INV-2"}' >/dev/null
check "AC-G2.10 · INV-2 (revertir) libera el compromiso" "$(q "SELECT count(*) FROM inventory_commitments WHERE event_id='$EV2'")" "0"

# Re-aceptar evento 2 para poder cancelarlo después (vuelve a generar el déficit)
curl -s -X PUT "$BASE/api/quotes/$Q2" $AC -H 'Content-Type: application/json' -d '{"status":"accepted"}' >/dev/null
check "evento 2 vuelve a accepted" "$(q "SELECT status FROM events WHERE id='$EV2'")" "accepted"
curl -s -X POST "$BASE/api/events/$EV2/transitions" $AC -H 'Content-Type: application/json' -d '{"transition":"INV-3","motivo":"test liberar stock"}' >/dev/null
check "AC-G2.9 · INV-3 (cancelar) libera el compromiso" "$(q "SELECT count(*) FROM inventory_commitments WHERE event_id='$EV2'")" "0"

# ── Cierre del evento 1 (deducción real) libera SU compromiso ──
PAY1=$(q "SELECT id FROM payments WHERE event_id='$EVENT' LIMIT 1")
curl -s -X PUT "$BASE/api/payments/$PAY1" $AC -H 'Content-Type: application/json' -d '{"paid":true}' >/dev/null
PAY2=$(q "SELECT id FROM payments WHERE event_id='$EVENT' OFFSET 1 LIMIT 1")
curl -s -X PUT "$BASE/api/payments/$PAY2" $AC -H 'Content-Type: application/json' -d '{"paid":true}' >/dev/null
curl -s -X POST "$BASE/api/events/$EVENT/close" $AC >/dev/null
check "AC-G2.11 · cerrar evento libera su compromiso" "$(q "SELECT count(*) FROM inventory_commitments WHERE event_id='$EVENT'")" "0"
check "G6 · stock real deducido y reflejado en inventory (espejo)" "$(q "SELECT quantity FROM inventory WHERE ingredient_id='$SOLOMILLO'")" "76000.000"

# ════════════════════════════════════════════════════════════
# G2 · Ruta manual /api/stock/generate-order ya no rompe (AC-G2.12)
# ════════════════════════════════════════════════════════════
echo "▸ G2 · ruta manual generate-order (antes rota por convert_uom ausente)…"
# 3er evento con déficit deliberado: tras cerrar el evento 1 quedan 76000g
# reales sin ningún compromiso activo; 400 raciones (80000g) > 76000g → 4000g de déficit.
mkevent "$EV3" "$Q3" "Cliente TRES" "tres@t.test" 400 80 10000.00 3200.00
curl -s -X PUT "$BASE/api/quotes/$Q3" $AC -H 'Content-Type: application/json' -d '{"status":"accepted"}' >/dev/null
# Borra el pedido auto-generado al aceptar para probar el botón manual desde cero.
q "DELETE FROM supplier_order_items WHERE order_id IN (SELECT id FROM supplier_orders WHERE event_id='$EV3')" >/dev/null
q "DELETE FROM supplier_orders WHERE event_id='$EV3'" >/dev/null
GO_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/stock/generate-order" $AC -H 'Content-Type: application/json' -d "{\"event_id\":\"$EV3\"}")
check "AC-G2.12 · POST /api/stock/generate-order ya no da 500" "$GO_CODE" "200"
check "AC-G2.12 · pedido manual creado" "$(q "SELECT count(*) FROM supplier_orders WHERE event_id='$EV3'")" "1"

# ════════════════════════════════════════════════════════════
# E1 · Modo bloqueante opcional
# ════════════════════════════════════════════════════════════
echo "▸ E1 · modo bloqueante opcional…"
q "UPDATE business_settings SET block_accept_on_stock_shortage = true" >/dev/null
# Evento 4: tras el evento 3 (comprometidos 80000g de 76000g reales), CUALQUIER
# demanda adicional de Solomillo VERIFY ya es déficit — sirve para probar el bloqueo.
mkevent "$EV4" "$Q4" "Cliente CUATRO" "cuatro@t.test" 50 90 1250.00 400.00
BLOCK_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/quotes/$Q4" $AC -H 'Content-Type: application/json' -d '{"status":"accepted"}')
check "E1 · con flag activo, aceptar con faltante → 409" "$BLOCK_CODE" "409"
check "E1 · evento 4 NO quedó accepted (rollback)" "$(q "SELECT status FROM events WHERE id='$EV4'")" "draft"
check "E1 · sin event_order creado (rollback completo)" "$(q "SELECT count(*) FROM event_orders WHERE event_id='$EV4'")" "0"
q "UPDATE business_settings SET block_accept_on_stock_shortage = false" >/dev/null

# ── Resultado ────────────────────────────────────────────────
echo "─────────────────────────────────────────────"
echo "RESULTADO:  $PASS OK  ·  $FAIL FALLOS"
[ "$FAIL" -eq 0 ] && echo "✅ Sprint 2 (G2+G6) verificado." || echo "❌ Hay fallos."
[ "$FAIL" -eq 0 ]
