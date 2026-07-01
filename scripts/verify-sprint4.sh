#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación Sprint 4 · Nivel A (G19-G22,G9-bug) + Nivel B
# (G10 staffing, G12 equipamiento, G11 merma, G13 CRM ownership,
#  G16 cierre unificado + facturación parcial, G17 whitelist status)
#
# Uso:  BASE=http://localhost:3939 bash scripts/verify-sprint4.sh
# Resiembra eventflow_verify (schema.sql + verify-ejemplo-e2e.sql).
# ============================================================
set -uo pipefail
BASE="${BASE:-http://localhost:3939}"
PGURL_ADMIN="PGPASSWORD=postgres psql -h localhost -U postgres"
PSQL="PGPASSWORD=postgres psql -h localhost -U postgres -d eventflow_verify -tAc"
EVENT="55555555-5555-5555-5555-555555555555"
QUOTE="66666666-6666-6666-6666-666666666666"
SOLOMILLO="11111111-1111-1111-1111-111111111111"
CLIENTE="44444444-4444-4444-4444-444444444444"
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
ko(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
q(){ eval "$PSQL \"$1\""; }
check(){ local d="$1" got="$2" exp="$3"; if [ "$got" = "$exp" ]; then ok "$d ($got)"; else ko "$d → got '$got', expected '$exp'"; fi; }
jget(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j.'+process.argv[1]))}catch(e){console.log('ERR')}})" "$1"; }

echo "═══ EventFlow · Sprint 4 · Nivel A (G19-G22,G9) + Nivel B (G10-G13,G16,G17) ═══"

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
# A1 · G19 — enlace lead↔evento vía FK real (no LOWER(name) difuso)
# ════════════════════════════════════════════════════════════
echo "▸ A1 (G19) · lead con nombre MUY distinto, vinculado solo por FK (INV-1: sent→lost)…"
A1_EVENT="a1000000-0000-0000-0000-000000000001"
A1_QUOTE="a1000000-0000-0000-0000-000000000002"
q "INSERT INTO leads (name, email, status) VALUES ('Nombre Totalmente Distinto VERIFY','distinto@verify.test','nuevo')" >/dev/null
LEAD1=$(q "SELECT id FROM leads WHERE email='distinto@verify.test'")
q "INSERT INTO events (id,client_name,client_email,event_type,guest_count,event_date,status)
   VALUES ('$A1_EVENT','Cliente A1 VERIFY','a1@t.test','boda',10,(now()+interval '90 days')::date,'sent')" >/dev/null
q "INSERT INTO quotes (id, event_id, status, lead_id, items, base_pvp, base_cost, total_pvp, total_cost, iva_pct)
   VALUES ('$A1_QUOTE','$A1_EVENT','sent','$LEAD1','[]'::jsonb,0,0,0,0,10)" >/dev/null
q "UPDATE events SET quote_id='$A1_QUOTE' WHERE id='$A1_EVENT'" >/dev/null
INV1=$(curl -s -X POST "$BASE/api/events/$A1_EVENT/transitions" $AC -H 'Content-Type: application/json' -d '{"transition":"INV-1","motivo":"prueba A1 VERIFY"}')
echo "$INV1" | grep -qi '"success":true' && ok "AC-A1.1 · INV-1 aceptado (evento marcado perdido)" || ko "INV-1: $INV1"
check "AC-A1.2 · evento → lost" "$(q "SELECT status FROM events WHERE id='$A1_EVENT'")" "lost"
check "AC-A1.3 · lead (nombre distinto del evento) → perdido vía FK, no LOWER(name)" "$(q "SELECT status FROM leads WHERE id='$LEAD1'")" "perdido"

# ════════════════════════════════════════════════════════════
# A4 · G22 — typo del dispatcher mapa-mas → mapa-mesas (chequeo estático)
# ════════════════════════════════════════════════════════════
echo "▸ A4 (G22) · dispatcher admin/page.tsx…"
if grep -q "mapa-mesas" src/app/admin/page.tsx 2>/dev/null; then
  ok "AC-A4.1 · referencia a 'mapa-mesas' presente"
else
  ko "AC-A4.1 · 'mapa-mesas' no encontrado en admin/page.tsx"
fi
if grep -q "mapa-mas'" src/app/admin/page.tsx 2>/dev/null; then
  ko "AC-A4.2 · el typo 'mapa-mas' sigue presente"
else
  ok "AC-A4.2 · typo 'mapa-mas' eliminado"
fi

# ════════════════════════════════════════════════════════════
# B1 · G10 — staffing: 3 líneas (camarero+cocinero+metre), resize sin duplicar
# ════════════════════════════════════════════════════════════
echo "▸ B1 (G10) · aceptar presupuesto → 3 líneas de staffing…"
ACCEPT=$(curl -s -X PUT "$BASE/api/quotes/$QUOTE" $AC -H 'Content-Type: application/json' -d '{"status":"accepted"}')
echo "$ACCEPT" | grep -qi '"error"' && ko "aceptar: $ACCEPT" || ok "AC-B1.0 · presupuesto aceptado"
check "AC-B1.1 · evento → accepted" "$(q "SELECT status FROM events WHERE id='$EVENT'")" "accepted"
check "AC-B1.2 · camarero(120,menú)=16" "$(q "SELECT slots_needed FROM staffing_lines WHERE event_id='$EVENT' AND role='camarero'")" "16"
check "AC-B1.3 · cocinero(120)=4"        "$(q "SELECT slots_needed FROM staffing_lines WHERE event_id='$EVENT' AND role='cocinero'")" "4"
check "AC-B1.4 · metre(120)=3"           "$(q "SELECT slots_needed FROM staffing_lines WHERE event_id='$EVENT' AND role='metre'")" "3"
check "AC-B1.5 · 3 líneas en total (no duplicados)" "$(q "SELECT count(*) FROM staffing_lines WHERE event_id='$EVENT'")" "3"

echo "▸ B1 (G10) · cambiar a 200 comensales y recalcular…"
q "UPDATE events SET guest_count=200 WHERE id='$EVENT'" >/dev/null
CALC=$(curl -s -X POST "$BASE/api/event-flow/$EVENT/calculate" $AC)
echo "$CALC" | grep -qi '"success":true' && ok "AC-B1.6 · /calculate aceptado" || ko "/calculate: $CALC"
check "AC-B1.7 · camarero(200,menú)=28 (antes solo se actualizaba este rol)" "$(q "SELECT slots_needed FROM staffing_lines WHERE event_id='$EVENT' AND role='camarero'")" "28"
check "AC-B1.8 · cocinero(200)=7 (antes quedaba obsoleto)" "$(q "SELECT slots_needed FROM staffing_lines WHERE event_id='$EVENT' AND role='cocinero'")" "7"
check "AC-B1.9 · metre(200)=5 (antes quedaba obsoleto)"   "$(q "SELECT slots_needed FROM staffing_lines WHERE event_id='$EVENT' AND role='metre'")" "5"
check "AC-B1.10 · sigue habiendo solo 3 líneas (upsert, no duplica)" "$(q "SELECT count(*) FROM staffing_lines WHERE event_id='$EVENT'")" "3"

# ════════════════════════════════════════════════════════════
# B2 · G12 — reserva automática de equipamiento (solo venue externo)
# ════════════════════════════════════════════════════════════
echo "▸ B2 (G12) · evento externo → hoja de logística reserva equipamiento…"
q "UPDATE events SET venue_type='externo' WHERE id='$EVENT'" >/dev/null
q "INSERT INTO equipment (name, category, unit, stock_quantity) VALUES ('Bandeja grande VERIFY','vajilla','ud',50)" >/dev/null
q "INSERT INTO equipment (name, category, unit, stock_quantity) VALUES ('Tabla de corte VERIFY','utensilio','ud',20)" >/dev/null
BANDEJA=$(q "SELECT id FROM equipment WHERE name='Bandeja grande VERIFY'")
TABLA=$(q "SELECT id FROM equipment WHERE name='Tabla de corte VERIFY'")
q "INSERT INTO equipment_rules (category, equipment_id, quantity_per_use, per_guest) VALUES ('carne','$BANDEJA',1,false)" >/dev/null
q "INSERT INTO equipment_rules (category, equipment_id, quantity_per_use, per_guest) VALUES ('carne','$TABLA',1,false)" >/dev/null
LOG=$(curl -s "$BASE/api/cocina/event/$EVENT/logistics" $AC)
echo "$LOG" | grep -qi '"success":true' && ok "AC-B2.1 · hoja de logística generada" || ko "logistics: $LOG"
check "AC-B2.2 · reserva automática creada (2 filas, sin botón manual)" "$(q "SELECT count(*) FROM event_equipment_checkout WHERE event_id='$EVENT'")" "2"
check "AC-B2.3 · quantity_sent > 0 para Bandeja grande VERIFY" "$(q "SELECT (quantity_sent > 0) FROM event_equipment_checkout WHERE event_id='$EVENT' AND equipment_id='$BANDEJA'")" "t"

echo "▸ B2 (G12) · marcar devuelto con merma (menos cantidad, con notas)…"
RET=$(curl -s -X PATCH "$BASE/api/cocina/equipment/checkout/$EVENT" $AC -H 'Content-Type: application/json' \
  -d "{\"action\":\"return\",\"equipment_id\":\"$BANDEJA\",\"quantity_returned\":0,\"condition_notes\":\"2 unidades rotas\"}")
echo "$RET" | grep -qi '"success":true' && ok "AC-B2.4 · devolución registrada" || ko "return: $RET"
check "AC-B2.5 · condition_notes refleja la merma" "$(q "SELECT condition_notes FROM event_equipment_checkout WHERE event_id='$EVENT' AND equipment_id='$BANDEJA'")" "2 unidades rotas"

# ════════════════════════════════════════════════════════════
# B3 · G11 — merma_pct persistida en import de recetas
# ════════════════════════════════════════════════════════════
echo "▸ B3 (G11) · importar CSV con merma_%=20…"
CSV3=$(mktemp)
printf 'plato,categoria,ingrediente,cantidad,unidad,merma_%%,notas\nSolomillo Merma VERIFY,carne,Ingrediente Merma VERIFY,100,g,20,\n' > "$CSV3"
curl -s -X POST "$BASE/api/cocina/recipes/import?commit=1" $AC -F "file=@$CSV3" >/dev/null
rm -f "$CSV3"
check "AC-B3.1 · merma_pct=20 persistido (antes se calculaba y se tiraba)" \
  "$(q "SELECT ri.merma_pct::int FROM recipe_items ri JOIN ingredients i ON i.id=ri.ingredient_id WHERE i.name='Ingrediente Merma VERIFY'")" "20"
check "AC-B3.2 · cantidad bruta = 100/(1-0.20) = 125" \
  "$(q "SELECT ri.quantity::int FROM recipe_items ri JOIN ingredients i ON i.id=ri.ingredient_id WHERE i.name='Ingrediente Merma VERIFY'")" "125"

# ════════════════════════════════════════════════════════════
# B4 · G13 — CRM: propietario (fuente única en leads) + interacciones
# ════════════════════════════════════════════════════════════
echo "▸ B4 (G13) · crear usuario comercial y loguearse…"
curl -s -X POST "$BASE/api/admin/users" $AC -H 'Content-Type: application/json' \
  -d '{"email":"comercial@verify.test","name":"Comercial VERIFY","password":"comercial123","role":"admin"}' >/dev/null
COMTOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"comercial@verify.test","password":"comercial123"}' | jget 'token')
[ -n "$COMTOKEN" ] && [ "$COMTOKEN" != "ERR" ] && ok "AC-B4.0 · login comercial" || ko "login comercial"
COMAC="-H Cookie:eventflow_token=$COMTOKEN"
COMID=$(q "SELECT id FROM admins WHERE email='comercial@verify.test'")

echo "▸ B4 (G13) · crear lead autenticado → assigned_to = creador…"
CREATED_LEAD=$(curl -s -X POST "$BASE/api/leads" $COMAC -H 'Content-Type: application/json' -d '{"name":"Lead Comercial VERIFY","email":"leadcomercial@verify.test"}')
LEAD2=$(echo "$CREATED_LEAD" | jget 'data.id')
check "AC-B4.1 · assigned_to = id del creador (fuente única)" "$(echo "$CREATED_LEAD" | jget 'data.assigned_to')" "$COMID"

echo "▸ B4 (G13) · el admin maestro (id sintético) NO rompe la creación de leads…"
MASTER_LEAD=$(curl -s -X POST "$BASE/api/leads" $AC -H 'Content-Type: application/json' -d '{"name":"Lead Master VERIFY","email":"leadmaster@verify.test"}')
echo "$MASTER_LEAD" | grep -q '"error"' && ko "AC-B4.2 · admin maestro no puede crear leads: $MASTER_LEAD" || ok "AC-B4.2 · admin maestro crea leads sin error (assigned_to=null)"

echo "▸ B4 (G13) · propiedad derivada por JOIN (sin columna propia en quotes/events)…"
q "UPDATE quotes SET lead_id='$LEAD2' WHERE id='$QUOTE'" >/dev/null
QUOTES_LIST=$(curl -s "$BASE/api/quotes" $AC)
check "AC-B4.3 · GET /api/quotes expone assigned_to derivado" \
  "$(echo "$QUOTES_LIST" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const row=(j.data||[]).find(q=>q.id==='$QUOTE');console.log(row&&row.assigned_to||'')}catch(e){console.log('ERR')}})")" \
  "$COMID"
EVENTS_LIST=$(curl -s "$BASE/api/events" $AC)
check "AC-B4.4 · GET /api/events expone assigned_to derivado (quote_id→lead_id)" \
  "$(echo "$EVENTS_LIST" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const row=(j.data||[]).find(e=>e.id==='$EVENT');console.log(row&&row.assigned_to||'')}catch(e){console.log('ERR')}})")" \
  "$COMID"

echo "▸ B4 (G13) · reasignar lead → el evento deriva el nuevo propietario…"
q "INSERT INTO admins (email, name, password_hash, role) VALUES ('segundo@verify.test','Segundo VERIFY','x','admin') ON CONFLICT (email) DO NOTHING" >/dev/null
SEGUNDOID=$(q "SELECT id FROM admins WHERE email='segundo@verify.test'")
REASSIGN=$(curl -s -X PATCH "$BASE/api/leads/$LEAD2/assign" $AC -H 'Content-Type: application/json' -d "{\"assigned_to\":\"$SEGUNDOID\"}")
echo "$REASSIGN" | grep -qi '"success":true' && ok "AC-B4.5 · reasignación aceptada" || ko "assign: $REASSIGN"
EVENTS_LIST2=$(curl -s "$BASE/api/events" $AC)
check "AC-B4.6 · evento sigue automáticamente al nuevo propietario" \
  "$(echo "$EVENTS_LIST2" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const row=(j.data||[]).find(e=>e.id==='$EVENT');console.log(row&&row.assigned_to||'')}catch(e){console.log('ERR')}})")" \
  "$SEGUNDOID"

echo "▸ B4 (G13) · registrar una interacción y verla en el timeline…"
INTER=$(curl -s -X POST "$BASE/api/interactions" $COMAC -H 'Content-Type: application/json' -d "{\"lead_id\":\"$LEAD2\",\"type\":\"llamada\",\"notes\":\"Primera llamada VERIFY\"}")
echo "$INTER" | grep -qi '"success":true' && ok "AC-B4.7 · interacción creada" || ko "interaction: $INTER"
TIMELINE=$(curl -s "$BASE/api/interactions?lead_id=$LEAD2" $AC)
check "AC-B4.8 · aparece en el timeline del lead" "$(echo "$TIMELINE" | jget 'data.length')" "1"

# ════════════════════════════════════════════════════════════
# A2/A5/B5 · G20 freeze canónico + NIF correcto + facturación parcial
# ════════════════════════════════════════════════════════════
echo "▸ A5 (G9-bug) · cliente con fiscal_nif poblado…"
q "UPDATE clients SET fiscal_nif='12345678A', fiscal_name='Cliente VERIFY SA' WHERE id='$CLIENTE'" >/dev/null

echo "▸ B5 (G16) · cerrar con invoiceAmount=1000 (de un total de 3000€)…"
CLOSE=$(curl -s -X POST "$BASE/api/events/$EVENT/close" $AC -H 'Content-Type: application/json' -d '{"invoiceAmount":1000}')
echo "$CLOSE" | grep -qi '"success":true' && ok "AC-B5.1 · cierre con importe parcial aceptado" || ko "close: $CLOSE"
check "AC-B5.2 · evento → completed" "$(q "SELECT status FROM events WHERE id='$EVENT'")" "completed"
check "AC-A2.1 · event_cost_deviations persistido (freeze canónico, no el inline pobre)" "$(q "SELECT count(*) FROM event_cost_deviations WHERE event_id='$EVENT'")" "1"
check "AC-A5.1 · factura con fiscal_nif correcto (antes client?.nif, siempre vacío)" "$(q "SELECT fiscal_nif FROM invoices WHERE event_id='$EVENT'")" "12345678A"
check "AC-B5.3 · 1 factura por 1000€ (no el total ni lo cobrado=0)" "$(q "SELECT subtotal FROM invoices WHERE event_id='$EVENT'")" "1000.00"
check "AC-B5.4 · payments siguen sin marcar paid (el cierre nunca fuerza pagos)" "$(q "SELECT count(*) FROM payments WHERE event_id='$EVENT' AND paid=true")" "0"

echo "▸ B5 (G16) · cobrar el resto manualmente y facturar la 2ª parte…"
DEPOSIT_ID=$(q "SELECT id FROM payments WHERE event_id='$EVENT' AND concept LIKE 'Señal%'")
curl -s -X PATCH "$BASE/api/payments/$DEPOSIT_ID" $AC -H 'Content-Type: application/json' -d '{"paid":true}' >/dev/null
check "AC-B5.5 · señal marcada paid manualmente" "$(q "SELECT paid FROM payments WHERE id='$DEPOSIT_ID'")" "t"

INV2ND=$(curl -s -X POST "$BASE/api/events/$EVENT/invoice" $AC -H 'Content-Type: application/json' -d '{"amount":1000}')
echo "$INV2ND" | grep -qi '"success":true' && ok "AC-B5.6 · 2ª factura (ruta reutilizable) aceptada" || ko "invoice: $INV2ND"
check "AC-B5.7 · ahora hay 2 facturas para el evento" "$(q "SELECT count(*) FROM invoices WHERE event_id='$EVENT'")" "2"
check "AC-B5.8 · suma de ambas facturas = 2000€" "$(q "SELECT SUM(subtotal) FROM invoices WHERE event_id='$EVENT'")" "2000.00"

echo "▸ B5 (G16) · idempotencia de cierre (re-cerrar no añade una 3ª factura)…"
curl -s -X POST "$BASE/api/events/$EVENT/close" $AC -H 'Content-Type: application/json' -d '{}' >/dev/null
check "AC-B5.9 · siguen exactamente 2 facturas" "$(q "SELECT count(*) FROM invoices WHERE event_id='$EVENT'")" "2"

# ════════════════════════════════════════════════════════════
# B6 · G17 — whitelist de events.status
# ════════════════════════════════════════════════════════════
echo "▸ B6 (G17) · PUT /api/events/[id] con status inventado…"
CODE_BAD=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/events/$EVENT" $AC -H 'Content-Type: application/json' -d '{"status":"cualquier-cosa-inventada"}')
check "AC-B6.1 · status inventado → 400 (antes se aceptaba sin más)" "$CODE_BAD" "400"
check "AC-B6.2 · el evento no cambió de estado" "$(q "SELECT status FROM events WHERE id='$EVENT'")" "completed"

echo "▸ B6 (G17) · un status válido de la whitelist sigue funcionando…"
DRAFT_EV="58888888-8888-8888-8888-888888888888"
q "INSERT INTO events (id,client_name,client_email,event_type,guest_count,event_date,status)
   VALUES ('$DRAFT_EV','Cliente B6 VERIFY','b6@t.test','boda',10,(now()+interval '90 days')::date,'draft') ON CONFLICT (id) DO NOTHING" >/dev/null
CODE_OK=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/events/$DRAFT_EV" $AC -H 'Content-Type: application/json' -d '{"status":"lost"}')
check "AC-B6.3 · status válido ('lost') → 200" "$CODE_OK" "200"
check "AC-B6.4 · el status sí se aplicó" "$(q "SELECT status FROM events WHERE id='$DRAFT_EV'")" "lost"

# ── Resultado ────────────────────────────────────────────────
echo "─────────────────────────────────────────────"
echo "RESULTADO:  $PASS OK  ·  $FAIL FALLOS"
[ "$FAIL" -eq 0 ] && echo "✅ Sprint 4 verificado." || echo "❌ Hay fallos que corregir."
[ "$FAIL" -eq 0 ]
