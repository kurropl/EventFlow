#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación E2E de Operativos (rama 010)
#   FR-A06 gastos previos · FR-A09 firma nómina · FR-A10 proveedores deuda ·
#   FR-A11 PDF venue externo · FR-A12 memo camareros
# Requiere: servidor en $BASE + BD sembrada con verify-ejemplo-e2e.sql
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
jget(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j.'+process.argv[1]))}catch(e){console.log('ERR')}})" "$1"; }
cc(){ local d="$1" got="$2" exp="$3"; [ "$got" = "$exp" ] && ok "$d ($got)" || ko "$d → $got (esperado $exp)"; }

echo "═══ EventFlow · Operativos (rama 010) ═══"
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"verify123"}' | jget 'token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "ERR" ] && ok "admin login" || { ko "login"; exit 1; }
AC="-H Cookie:eventflow_token=$TOKEN"

# ── FR-A06 · gastos previos suman al total ──────────────────
echo "▸ FR-A06 · gastos previos en presupuesto…"
TC0=$(q "SELECT total_cost::numeric(12,2) FROM events WHERE id='$EVENT'")
curl -s -X POST "$BASE/api/events/$EVENT/gastos-previos" $AC -H 'Content-Type: application/json' \
  -d '{"concept":"Gasolina furgoneta","amount":50}' >/dev/null
TC1=$(q "SELECT total_cost::numeric(12,2) FROM events WHERE id='$EVENT'")
cc "total_cost += 50" "$TC1" "$(q "SELECT ($TC0 + 50)::numeric(12,2)")"
cc "gasto previo listado" "$(curl -s "$BASE/api/events/$EVENT/gastos-previos" $AC | jget 'data.length')" "1"

# ── FR-A10 · proveedores: deuda, vencimientos, justificante ─
echo "▸ FR-A10 · cuentas a pagar a proveedores…"
q "INSERT INTO providers (id,name,category) VALUES ('77777777-7777-7777-7777-777777777777','Prov VERIFY','catering') ON CONFLICT DO NOTHING" >/dev/null
# Factura ya vencida (due_date en el pasado)
INV=$(curl -s -X POST "$BASE/api/provider-invoices" $AC -H 'Content-Type: application/json' \
  -d '{"provider_id":"77777777-7777-7777-7777-777777777777","concept":"Pescado","amount":300,"due_date":"2020-01-01"}')
IID=$(echo "$INV" | jget 'data.id')
[ -n "$IID" ] && [ "$IID" != "ERR" ] && ok "factura de proveedor creada" || ko "crear factura: $INV"
L=$(curl -s "$BASE/api/provider-invoices" $AC)
cc "estado vencido (due_date pasada)" "$(q "SELECT status FROM provider_invoices WHERE id='$IID'")" "vencido"
cc "debe_total incluye la deuda (>=300)" "$(echo "$L" | jget 'resumen.debe_total>=300')" "true"
curl -s -X PUT "$BASE/api/provider-invoices/$IID" $AC -H 'Content-Type: application/json' \
  -d '{"status":"pagado","proof_url":"/justificantes/x.pdf"}' >/dev/null
cc "marcar pagado → pagado + paid_at" "$(q "SELECT (status='pagado' AND paid_at IS NOT NULL) FROM provider_invoices WHERE id='$IID'")" "t"

# ── FR-A09 · firma tras pago de nómina ──────────────────────
echo "▸ FR-A09 · firma tras pago de nómina…"
q "INSERT INTO workers (id,name,phone,roles) VALUES ('88888888-8888-8888-8888-888888888888','Worker VERIFY','+34600111222','{camarero}') ON CONFLICT DO NOTHING" >/dev/null
q "INSERT INTO worker_event_pay (id,worker_id,event_id,hours,hourly_rate,total_pay,status) VALUES ('99999999-9999-9999-9999-999999999999','88888888-8888-8888-8888-888888888888','$EVENT',8,12,96,'pending') ON CONFLICT (worker_id,event_id) DO UPDATE SET status='pending', signature_url=NULL, signed_at=NULL" >/dev/null
PAYID=$(q "SELECT id FROM worker_event_pay WHERE worker_id='88888888-8888-8888-8888-888888888888' AND event_id='$EVENT'")
RC=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/staffing/pay/$PAYID/sign" $AC -H 'Content-Type: application/json' -d '{"signature_url":"/firmas/x.png"}')
cc "firmar antes de pagar → 400" "$RC" "400"
q "UPDATE worker_event_pay SET status='paid', paid_at=now() WHERE id='$PAYID'" >/dev/null
SR=$(curl -s -X POST "$BASE/api/staffing/pay/$PAYID/sign" $AC -H 'Content-Type: application/json' -d '{"signature_url":"/firmas/x.png","signed_by":"Worker VERIFY"}')
cc "firmar tras pagar → ok" "$(echo "$SR" | jget 'success')" "true"
cc "firma persistida" "$(q "SELECT (signature_url IS NOT NULL AND signed_at IS NOT NULL) FROM worker_event_pay WHERE id='$PAYID'")" "t"

# ── FR-A12 · memo por trabajador ────────────────────────────
echo "▸ FR-A12 · memo por trabajador…"
# Asignar el worker a una línea de staffing del evento
q "INSERT INTO staffing_lines (id,event_id,role,slots_needed,status,location,uniform) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','$EVENT','camarero',1,'open','Sala','Traje negro') ON CONFLICT DO NOTHING" >/dev/null
q "INSERT INTO staffing_assignments (staffing_line_id,worker_id,position) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','88888888-8888-8888-8888-888888888888',1) ON CONFLICT DO NOTHING" >/dev/null
MEMO=$(curl -s "$BASE/api/briefing/$EVENT/memo" $AC)
cc "memo generado para 1 trabajador" "$(echo "$MEMO" | jget 'data.total_memos>=1')" "true"
echo "$MEMO" | jget "data.memos[0].memo" | grep -qi "memo para el evento" && ok "memo contiene datos del evento" || ko "memo sin contenido"

# ── FR-A11 · PDF del venue externo → sitting listo ──────────
echo "▸ FR-A11 · PDF del venue externo…"
curl -s -X PUT "$BASE/api/events/$EVENT" $AC -H 'Content-Type: application/json' \
  -d '{"venue_type":"externo","venue_pdf_url":"/planos/finca.pdf"}' >/dev/null
G=$(curl -s "$BASE/api/cocina/guia/$EVENT" $AC)
cc "guía: sitting listo con PDF" "$(echo "$G" | jget "data.fases.find(f=>f.key=='sitting').estado")" "listo"

# ── Cron T-1 ────────────────────────────────────────────────
echo "▸ FR-A12 · cron pre-event-briefing (T-1)…"
cc "cron responde ok" "$(curl -s "$BASE/api/cron/pre-event-briefing" | jget 'success')" "true"

echo "─────────────────────────────────────────────"
echo "RESULTADO:  $PASS OK  ·  $FAIL FALLOS"
[ "$FAIL" -eq 0 ] && echo "✅ Operativos correctos." || echo "❌ Hay fallos que corregir."
exit "$FAIL"
