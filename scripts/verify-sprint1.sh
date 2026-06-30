#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación Sprint 1 · Core Business (G1 + G3)
# G1: imposible doble reserva de salón (constraint EXCLUDE gist).
# G3: coste de personal (worker_event_pay) en la rentabilidad/P&L.
#
# Uso:  BASE=http://localhost:3939 bash scripts/verify-sprint1.sh
# Resiembra eventflow_verify (schema.sql + verify-ejemplo-e2e.sql).
# ============================================================
set -uo pipefail
BASE="${BASE:-http://localhost:3939}"
PGURL_ADMIN="PGPASSWORD=postgres psql -h localhost -U postgres"
PSQL="PGPASSWORD=postgres psql -h localhost -U postgres -d eventflow_verify -tAc"
EVENT="55555555-5555-5555-5555-555555555555"
QUOTE="66666666-6666-6666-6666-666666666666"
EV2="52222222-2222-2222-2222-222222222222"
WK1="51111111-1111-1111-1111-111111111111"
WK2="59999999-9999-9999-9999-999999999999"
EA="5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
EB="5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
EC="5ccccccc-cccc-cccc-cccc-cccccccccccc"
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
ko(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
q(){ eval "$PSQL \"$1\""; }
qq(){ eval "$PSQL \"$1\"" 2>&1; }  # captura errores (para el test de exclusión)
check(){ local d="$1" got="$2" exp="$3"; if [ "$got" = "$exp" ]; then ok "$d ($got)"; else ko "$d → got '$got', expected '$exp'"; fi; }
jget(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j.'+process.argv[1]))}catch(e){console.log('ERR')}})" "$1"; }

echo "═══ EventFlow · Sprint 1 · Core Business (G1 + G3) ═══"

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

check "seed: 2 salones en venues" "$(q "SELECT count(*) FROM venues")" "2"
ARRIBA=$(q "SELECT id FROM venues WHERE slug='salon-arriba'")
ABAJO=$(q "SELECT id FROM venues WHERE slug='salon-abajo'")

# ════════════════════════════════════════════════════════════
# G1 · Reserva de salón — nivel BASE DE DATOS (garantía dura)
# ════════════════════════════════════════════════════════════
echo "▸ G1 · constraint EXCLUDE (nivel BD)…"
for E in "$EA" "$EB" "$EC"; do
  q "INSERT INTO events (id,client_name,client_email,event_type,guest_count,event_date,status)
     VALUES ('$E','Test $E','t@t.test','boda',10,'2030-05-01','draft') ON CONFLICT (id) DO NOTHING" >/dev/null
done

q "INSERT INTO venue_bookings (venue_id,event_id,event_date) VALUES ('$ARRIBA','$EA','2030-05-01')" >/dev/null
# AC-G1.1 · mismo salón + mismo día → la 2ª inserción DEBE fallar (23P01)
ERR=$(qq "INSERT INTO venue_bookings (venue_id,event_id,event_date) VALUES ('$ARRIBA','$EB','2030-05-01')")
echo "$ERR" | grep -qi "exclusion constraint" && ok "AC-G1.1 · solapamiento rechazado por el motor (23P01)" || ko "AC-G1.1 · no saltó la exclusión: $ERR"
check "AC-G1.1 · sigue habiendo 1 reserva ese salón+día" "$(q "SELECT count(*) FROM venue_bookings WHERE venue_id='$ARRIBA' AND event_date='2030-05-01'")" "1"

# AC-G1.2 · mismo salón, día distinto → permitido
q "INSERT INTO venue_bookings (venue_id,event_id,event_date) VALUES ('$ARRIBA','$EB','2030-05-02')" >/dev/null
check "AC-G1.2 · mismo salón otro día permitido" "$(q "SELECT count(*) FROM venue_bookings WHERE venue_id='$ARRIBA'")" "2"

# AC-G1.3 · distinto salón, mismo día → permitido
q "INSERT INTO venue_bookings (venue_id,event_id,event_date) VALUES ('$ABAJO','$EC','2030-05-01')" >/dev/null
check "AC-G1.3 · distinto salón mismo día permitido" "$(q "SELECT count(*) FROM venue_bookings WHERE event_date='2030-05-01'")" "2"

# ════════════════════════════════════════════════════════════
# G1 · Reserva de salón — nivel API (dominio + 409 + liberación)
# ════════════════════════════════════════════════════════════
echo "▸ G1 · reserva vía API (dominio)…"
D=$(q "SELECT event_date FROM events WHERE id='$EVENT'")

# Asignar Salón de Arriba al evento fixture (su fecha D)
curl -s -X PUT "$BASE/api/events/$EVENT" $AC -H 'Content-Type: application/json' -d '{"venue":"salon-arriba"}' >/dev/null
check "evento fixture → venue_type benitez" "$(q "SELECT venue_type FROM events WHERE id='$EVENT'")" "benitez"
check "reserva creada para el fixture" "$(q "SELECT count(*) FROM venue_bookings WHERE event_id='$EVENT'")" "1"

# AC-G1.5 · idempotencia: reasignar el mismo salón no duplica
curl -s -X PUT "$BASE/api/events/$EVENT" $AC -H 'Content-Type: application/json' -d '{"venue":"salon-arriba"}' >/dev/null
check "AC-G1.5 · reserva idempotente (sigue 1)" "$(q "SELECT count(*) FROM venue_bookings WHERE event_id='$EVENT'")" "1"

# AC-G1.4 · externo no reserva recurso
curl -s -X PUT "$BASE/api/events/$EV2" $AC -H 'Content-Type: application/json' -d '{}' >/dev/null 2>&1
q "INSERT INTO events (id,client_name,client_email,event_type,guest_count,event_date,status)
   VALUES ('$EV2','Evento 2','e2@t.test','boda',80,'$D','draft') ON CONFLICT (id) DO NOTHING" >/dev/null
curl -s -X PUT "$BASE/api/events/$EV2" $AC -H 'Content-Type: application/json' -d '{"venue":"externo"}' >/dev/null
check "AC-G1.4 · evento externo sin reserva" "$(q "SELECT count(*) FROM venue_bookings WHERE event_id='$EV2'")" "0"

# AC-G1.6 · conflicto vía API → 409 (mismo salón + misma fecha D que el fixture)
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/events/$EV2" $AC -H 'Content-Type: application/json' -d '{"venue":"salon-arriba"}')
check "AC-G1.6 · 2º evento mismo salón+día → HTTP 409" "$CODE" "409"
check "AC-G1.6 · conflicto no dejó reserva (rollback)" "$(q "SELECT count(*) FROM venue_bookings WHERE event_id='$EV2'")" "0"

# AC-G1.7 · acceptQuote re-reserva idempotente + INV-3 (cancelar) libera el salón
curl -s -X POST "$BASE/api/quotes/public/$QUOTE/accept" -H 'Content-Type: application/json' >/dev/null
check "acceptQuote mantiene la reserva (idempotente)" "$(q "SELECT count(*) FROM venue_bookings WHERE event_id='$EVENT'")" "1"
curl -s -X POST "$BASE/api/events/$EVENT/transitions" $AC -H 'Content-Type: application/json' -d '{"transition":"INV-3","motivo":"test liberar salón"}' >/dev/null
check "AC-G1.7 · INV-3 libera la reserva" "$(q "SELECT count(*) FROM venue_bookings WHERE event_id='$EVENT'")" "0"
CODE2=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/events/$EV2" $AC -H 'Content-Type: application/json' -d '{"venue":"salon-arriba"}')
check "AC-G1.7 · salón liberado: 2º evento ya reserva (200)" "$CODE2" "200"

# ════════════════════════════════════════════════════════════
# G3 · Coste de personal en el P&L (D4: cuenta solo pagadas)
# ════════════════════════════════════════════════════════════
echo "▸ G3 · coste de personal en rentabilidad…"
TC_BEFORE=$(q "SELECT total_cost::numeric(12,2) FROM events WHERE id='$EVENT'")
q "INSERT INTO workers (id,name,phone,roles,active) VALUES ('$WK1','Worker UNO','600111222','{camarero}',true) ON CONFLICT (id) DO NOTHING" >/dev/null
q "INSERT INTO workers (id,name,phone,roles,active) VALUES ('$WK2','Worker DOS','600333444','{cocinero}',true) ON CONFLICT (id) DO NOTHING" >/dev/null

# Nómina 1: 5h × 60 = 300, pendiente
PAY1=$(curl -s -X POST "$BASE/api/staffing/pay" $AC -H 'Content-Type: application/json' \
  -d "{\"worker_id\":\"$WK1\",\"event_id\":\"$EVENT\",\"hours\":5,\"hourly_rate\":60}")
PID1=$(echo "$PAY1" | jget 'data.id')
# D4: pendiente NO cuenta → sin línea 'personal' todavía
check "G3 · nómina pendiente no crea línea personal" "$(q "SELECT count(*) FROM cost_desglose WHERE event_id='$EVENT' AND line_type='personal'")" "0"

# Marcar pagada → línea personal = 300
curl -s -X PUT "$BASE/api/staffing/pay" $AC -H 'Content-Type: application/json' -d "{\"id\":\"$PID1\",\"status\":\"paid\"}" >/dev/null
check "AC-G3.2 · línea personal = 300 (pagada)" "$(q "SELECT COALESCE(SUM(total),0)::int FROM cost_desglose WHERE event_id='$EVENT' AND line_type='personal'")" "300"

# Nómina 2: 4h × 50 = 200, pagada
PAY2=$(curl -s -X POST "$BASE/api/staffing/pay" $AC -H 'Content-Type: application/json' \
  -d "{\"worker_id\":\"$WK2\",\"event_id\":\"$EVENT\",\"hours\":4,\"hourly_rate\":50}")
PID2=$(echo "$PAY2" | jget 'data.id')
curl -s -X PUT "$BASE/api/staffing/pay" $AC -H 'Content-Type: application/json' -d "{\"id\":\"$PID2\",\"status\":\"paid\"}" >/dev/null
check "AC-G3.2 · línea personal = 500 (300+200)" "$(q "SELECT COALESCE(SUM(total),0)::int FROM cost_desglose WHERE event_id='$EVENT' AND line_type='personal'")" "500"
check "AC-G3.3 · idempotente: 1 sola línea personal" "$(q "SELECT count(*) FROM cost_desglose WHERE event_id='$EVENT' AND line_type='personal'")" "1"

# AC-G3.1 · total_cost NO cambia (R2/AC2.1 intacto)
check "AC-G3.1 · total_cost sin cambios (no incluye personal)" "$(q "SELECT total_cost::numeric(12,2) FROM events WHERE id='$EVENT'")" "$TC_BEFORE"

# AC-G3.4 · rentabilidad descuenta personal pagado y refleja el total
RENT=$(curl -s "$BASE/api/rentabilidad" $AC)
LP=$(echo "$RENT" | jget "data.find(e=>e.id==='$EVENT').laborCostPaid")
GM=$(echo "$RENT" | jget "data.find(e=>e.id==='$EVENT').grossMargin")
PVP=$(echo "$RENT" | jget "data.find(e=>e.id==='$EVENT').totalPvp")
check "AC-G3.4 · rentabilidad laborCostPaid = 500" "$LP" "500"
check "AC-G3.4 · grossMargin = pvp - (total_cost+personal)" "$GM" "$(q "SELECT (${PVP} - ${TC_BEFORE} - 500)::numeric(12,2)::float8")"

# AC-G3.5 · recálculo al borrar nómina
curl -s -X DELETE "$BASE/api/staffing/pay?id=$PID2" $AC >/dev/null
check "AC-G3.5 · borrar 1 nómina → personal = 300" "$(q "SELECT COALESCE(SUM(total),0)::int FROM cost_desglose WHERE event_id='$EVENT' AND line_type='personal'")" "300"
curl -s -X DELETE "$BASE/api/staffing/pay?id=$PID1" $AC >/dev/null
check "AC-G3.5 · sin nóminas → línea personal eliminada" "$(q "SELECT count(*) FROM cost_desglose WHERE event_id='$EVENT' AND line_type='personal'")" "0"

# ── Resultado ────────────────────────────────────────────────
echo "─────────────────────────────────────────────"
echo "RESULTADO:  $PASS OK  ·  $FAIL FALLOS"
[ "$FAIL" -eq 0 ] && echo "✅ Sprint 1 (G1+G3) verificado." || echo "❌ Hay fallos."
[ "$FAIL" -eq 0 ]
