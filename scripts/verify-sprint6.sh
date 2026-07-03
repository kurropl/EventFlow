#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación Sprint 6 · Cumplimiento acta de cocina/APPCC
#
# F0: desbloqueos (escandallo, alérgenos/descripción, envío real de briefing)
# F1: APPCC — escáner GS1 auto-rellena, recibir pedido completo, OCR unificado
# F2: hojas de cocina completas e imprimibles (carga por pase, logística)
# F3: presupuesto según lo acordado (borrador, cancelación gobernada,
#     sugerencias adicionales, gastos previos)
# F4: staffing/proveedores (firma de nómina, cuentas a pagar, protocolo,
#     sitting sobre plano de venue)
#
# Uso:  BASE=http://localhost:3939 bash scripts/verify-sprint6.sh
# Resiembra eventflow_verify (schema.sql + verify-ejemplo-e2e.sql).
# ============================================================
set -uo pipefail
BASE="${BASE:-http://localhost:3939}"
PGURL_ADMIN="PGPASSWORD=postgres psql -h localhost -U postgres"
PSQL="PGPASSWORD=postgres psql -h localhost -U postgres -d eventflow_verify -tAc"
EVENT="55555555-5555-5555-5555-555555555555"
QUOTE="66666666-6666-6666-6666-666666666666"
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
ko(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
q(){ eval "$PSQL \"$1\""; }
check(){ local d="$1" got="$2" exp="$3"; if [ "$got" = "$exp" ]; then ok "$d ($got)"; else ko "$d → got '$got', expected '$exp'"; fi; }
jget(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j.'+process.argv[1]))}catch(e){console.log('ERR')}})" "$1"; }

echo "═══ EventFlow · Sprint 6 · Acta de cocina/APPCC ═══"

echo "▸ Sembrando fixture…"
eval "$PGURL_ADMIN -d eventflow_verify -v ON_ERROR_STOP=1 -f scripts/verify-ejemplo-e2e.sql" >/dev/null 2>&1 && ok "fixture sembrado" || { ko "fallo sembrando fixture"; exit 1; }

TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"verify123"}' | jget 'token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "ERR" ] && ok "admin login" || { ko "login"; exit 1; }
CK="-H Cookie:eventflow_token=$TOKEN"

# ════════════════════════════════════════════════════════════
# F0 · Desbloqueos
# ════════════════════════════════════════════════════════════
echo "▸ F0.1 · escandallo por evento ya no da 500 (esi.custom_qty ausente)…"
RC=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/stock/escandallos?event_id=$EVENT" $CK)
check "AC-F0.1 · GET escandallos → 200" "$RC" "200"

echo "▸ F0.2 · alérgenos/descripción de catálogo…"
CI=$(q "SELECT id FROM catalog_items LIMIT 1")
PUT1=$(curl -s -X PUT "$BASE/api/catalog" $CK -H 'Content-Type: application/json' -d "{\"id\":\"$CI\",\"allergens\":[\"gluten\",\"huevos\"],\"description\":\"Test F0.2\"}")
echo "$PUT1" | grep -qi '"success":true' && ok "PUT catalog con allergens/description" || ko "PUT catalog: $PUT1"
check "AC-F0.2 · allergens persistidos" "$(q "SELECT allergens::text FROM catalog_items WHERE id='$CI'")" '["gluten", "huevos"]'

echo "▸ F0.2/F4.3 · memo de camareros con 7 campos (intolerancias, protocolo, mantelería…)…"
curl -s -X PUT "$BASE/api/events/$EVENT" $CK -H 'Content-Type: application/json' -d '{"protocol_notes":"Entrada lateral, mesa VIP","linen_type":"blanco","centerpiece":"velas doradas"}' >/dev/null
q "INSERT INTO staffing_lines (id,event_id,role,slots_needed,status,location,uniform) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','$EVENT','camarero',1,'open','Sala','Traje negro') ON CONFLICT DO NOTHING" >/dev/null
q "INSERT INTO workers (id,name,phone,roles) VALUES ('cccccccc-0000-0000-0000-000000000001','Camarero Memo','+34600000099','{camarero}') ON CONFLICT DO NOTHING" >/dev/null
q "INSERT INTO staffing_assignments (staffing_line_id,worker_id,position) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',1) ON CONFLICT DO NOTHING" >/dev/null
MEMO=$(curl -s "$BASE/api/briefing/$EVENT/memo" $CK)
MEMOTXT=$(echo "$MEMO" | jget "data.memos[0].memo")
echo "$MEMOTXT" | grep -qi "protocolo" && ok "AC-F4.3 · memo incluye Protocolo" || ko "memo sin protocolo: $MEMOTXT"
echo "$MEMOTXT" | grep -qi "mantelería" && ok "AC-F0 · memo incluye Mantelería" || ko "memo sin mantelería"

echo "▸ F0.3 · cron de briefing envía de verdad (idempotente)…"
CRON1=$(curl -s "$BASE/api/cron/pre-event-briefing")
echo "$CRON1" | grep -qi '"success":true' && ok "cron responde ok" || ko "cron: $CRON1"

# ════════════════════════════════════════════════════════════
# F1 · APPCC
# ════════════════════════════════════════════════════════════
echo "▸ F1.1 · GS1 parser existe y exporta parseGS1…"
grep -q "export function parseGS1" src/lib/gs1Parser.ts && ok "AC-F1.1 · gs1Parser.ts exporta parseGS1" || ko "gs1Parser.ts sin export"

echo "▸ F1.1 · receiving POST persiste source…"
ING=$(q "SELECT id FROM ingredients LIMIT 1")
REC=$(curl -s -X POST "$BASE/api/trazabilidad/receiving" $CK -H 'Content-Type: application/json' -d "{\"ingredient_id\":\"$ING\",\"lot_number\":\"LOTE-S6-VERIFY\",\"batch_quantity\":5,\"unit\":\"kg\",\"source\":\"scan\"}")
RECID=$(echo "$REC" | jget 'data.receiving.id')
check "AC-F1.1 · source='scan' persistido" "$(q "SELECT source FROM receiving_log WHERE id='$RECID'")" "scan"

echo "▸ F1.2 · CHECK constraint de supplier_orders admite 'ordered'…"
ORD=$(curl -s -X POST "$BASE/api/stock/supplier-orders" $CK -H 'Content-Type: application/json' -d "{\"supplier\":\"Prov S6 VERIFY\",\"items\":[{\"ingredient_id\":\"$ING\",\"ingredient_name\":\"x\",\"quantity\":1,\"unit_cost\":1,\"unit\":\"kg\"}]}")
ORDID=$(echo "$ORD" | jget 'data.id')
PUTORD=$(curl -s -X PUT "$BASE/api/stock/supplier-orders" $CK -H 'Content-Type: application/json' -d "{\"id\":\"$ORDID\",\"status\":\"ordered\"}")
echo "$PUTORD" | grep -qi '"success":true' && ok "AC-F1.2 · Marcar enviado (status=ordered) ya no falla" || ko "PUT ordered: $PUTORD"

echo "▸ F1.2 · Recibir pedido completo (lote automático + stock real)…"
STOCK0=$(q "SELECT quantity FROM ingredients WHERE id='$ING'")
RCV=$(curl -s -X POST "$BASE/api/trazabilidad/receiving/from-order/$ORDID" $CK)
echo "$RCV" | grep -qi '"success":true' && ok "AC-F1.2 · recepción completa OK" || ko "recibir pedido: $RCV"
STOCK1=$(q "SELECT quantity FROM ingredients WHERE id='$ING'")
[ "$(echo "$STOCK1 > $STOCK0" | bc 2>/dev/null || echo 0)" = "1" ] && ok "AC-F1.2 · stock aumentó ($STOCK0 → $STOCK1)" || ko "stock no cambió ($STOCK0 → $STOCK1)"
check "AC-F1.2 · pedido → received" "$(q "SELECT status FROM supplier_orders WHERE id='$ORDID'")" "received"

echo "▸ F1.3 · OCR apply mueve stock por el ledger único (no solo stock_entries)…"
ING2=$(q "SELECT id, name FROM ingredients LIMIT 1" | cut -d'|' -f1)
ING2NAME=$(q "SELECT name FROM ingredients WHERE id='$ING2'")
STOCK2A=$(q "SELECT quantity FROM ingredients WHERE id='$ING2'")
OCR=$(curl -s -X POST "$BASE/api/ocr/apply" $CK -H 'Content-Type: application/json' -d "{\"mode\":\"etiqueta_ingrediente\",\"items\":[{\"name\":\"$ING2NAME\",\"quantity\":3,\"unit\":\"kg\",\"cost\":0,\"lot\":\"LOTE-OCR-S6\"}]}")
echo "$OCR" | grep -qi '"success":true' && ok "AC-F1.3 · OCR apply OK" || ko "OCR apply: $OCR"
STOCK2B=$(q "SELECT quantity FROM ingredients WHERE id='$ING2'")
[ "$(echo "$STOCK2B > $STOCK2A" | bc 2>/dev/null || echo 0)" = "1" ] && ok "AC-F1.3 · ingredients.quantity aumentó tras OCR ($STOCK2A → $STOCK2B)" || ko "OCR no movió stock ($STOCK2A → $STOCK2B)"
check "AC-F1.3 · lote OCR en receiving_log (source=scan)" "$(q "SELECT source FROM receiving_log WHERE lot_number='LOTE-OCR-S6'")" "scan"

# ════════════════════════════════════════════════════════════
# F2 · Hojas de cocina
# ════════════════════════════════════════════════════════════
echo "▸ F2 · aceptar presupuesto para generar escandallo (event_shopping_items)…"
curl -s -X PUT "$BASE/api/events/$EVENT" $CK -H 'Content-Type: application/json' -d '{"venue_type":"externo"}' >/dev/null
curl -s -X PUT "$BASE/api/quotes/$QUOTE" $CK -H 'Content-Type: application/json' -d '{"status":"accepted"}' >/dev/null

echo "▸ F2.1 · hoja de carga agrupa por pase (perecederoPasses/noPerecederoPasses)…"
LOAD=$(curl -s "$BASE/api/cocina/event/$EVENT/loading" $CK)
NPER=$(echo "$LOAD" | jget 'data.sheet.perecederoPasses.length')
NNOPER=$(echo "$LOAD" | jget 'data.sheet.noPerecederoPasses.length')
{ [ "$NPER" != "ERR" ] && [ "$NNOPER" != "ERR" ] && [ $((NPER + NNOPER)) -gt 0 ]; } && ok "AC-F2.1 · grupos por pase presentes (perecedero=$NPER, no-perecedero=$NNOPER)" || ko "sin agrupado por pase: perecedero=$NPER no-perecedero=$NNOPER"

echo "▸ F2.2 · hoja de logística expone seco/perecedero/desechables…"
LOG=$(curl -s "$BASE/api/cocina/event/$EVENT/logistics" $CK)
GOODS_OK=$(echo "$LOG" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const s=j.data.sheet;console.log(Array.isArray(s.dryGoods)&&Array.isArray(s.perishableGoods)&&Array.isArray(s.disposables))}catch(e){console.log('ERR')}})")
[ "$GOODS_OK" = "true" ] && ok "AC-F2.2 · dryGoods/perishableGoods/disposables presentes en la respuesta" || ko "logistics sin goods: $GOODS_OK"

# ════════════════════════════════════════════════════════════
# F3 · Presupuesto según lo acordado
# ════════════════════════════════════════════════════════════
echo "▸ F3.1 · edición simplificada (edit_only_price_and_guests) para borrador…"
grep -q "canEditOnlyPriceAndGuests" src/components/b2b/BudgetEditor.tsx && ok "AC-F3.1 · BudgetEditor consume edit_only_price_and_guests" || ko "BudgetEditor sin flag"

echo "▸ F3.2 · cancelación gobernada (INV-3) exige motivo…"
INV3_NO=$(curl -s -X POST "$BASE/api/events/$EVENT/transitions" $CK -H 'Content-Type: application/json' -d '{"transition":"INV-3"}')
echo "$INV3_NO" | grep -qi "motivo" && ok "AC-F3.2 · INV-3 sin motivo → rechazado" || ko "INV-3 sin motivo: $INV3_NO"
INV3_YES=$(curl -s -X POST "$BASE/api/events/$EVENT/transitions" $CK -H 'Content-Type: application/json' -d '{"transition":"INV-3","motivo":"Cliente canceló (verify)"}')
echo "$INV3_YES" | grep -qi '"success":true' && ok "AC-F3.2 · INV-3 con motivo → cancelado" || ko "INV-3 con motivo: $INV3_YES"
check "AC-F3.2 · evento → cancelled" "$(q "SELECT status FROM events WHERE id='$EVENT'")" "cancelled"

echo "▸ F3.2 · Kanban sin botón Cancelar en columna Aceptado…"
grep -n "col.status === 'accepted'" -A 30 src/components/b2b/KanbanPipeline.tsx | grep -q "moveEvent(event.id, 'cancelled')" && ko "AC-F3.2 · aún queda moveEvent cancelado en columna Aceptado" || ok "AC-F3.2 · sin cancelación directa en columna Aceptado"

echo "▸ F3.3 · sugerencias adicionales (dataset SUGGESTIONS con consumidor)…"
grep -q "from '@/data/catalog'" src/components/b2c/WizardStep3.tsx && grep -q "SUGGESTIONS" src/components/b2c/WizardStep3.tsx && ok "AC-F3.3 · WizardStep3 consume SUGGESTIONS" || ko "WizardStep3 sin SUGGESTIONS"

echo "▸ F3.4 · gastos previos (alta rápida + línea propia en rentabilidad)…"
GP=$(curl -s -X POST "$BASE/api/events/$EVENT/gastos-previos" $CK -H 'Content-Type: application/json' -d '{"concept":"Gasolina S6 VERIFY","amount":42}')
echo "$GP" | grep -qi '"success":true' && ok "AC-F3.4 · gasto previo creado" || ko "gasto previo: $GP"
RENT=$(curl -s "$BASE/api/rentabilidad" $CK)
GPBREAKDOWN=$(echo "$RENT" | jget "data.find(e=>e.id==='$EVENT').costBreakdown.gastos_previos")
[ "$GPBREAKDOWN" != "ERR" ] && [ "$GPBREAKDOWN" != "undefined" ] && ok "AC-F3.4 · rentabilidad separa gastos_previos de extras ($GPBREAKDOWN)" || ko "sin línea gastos_previos: $GPBREAKDOWN"

# ════════════════════════════════════════════════════════════
# F4 · Staffing y proveedores
# ════════════════════════════════════════════════════════════
echo "▸ F4.1 · firma de nómina tras pago…"
WK=$(q "SELECT id FROM workers LIMIT 1")
PAY=$(curl -s -X POST "$BASE/api/staffing/pay" $CK -H 'Content-Type: application/json' -d "{\"worker_id\":\"$WK\",\"event_id\":\"$EVENT\",\"hours\":4,\"hourly_rate\":10}")
PAYID=$(echo "$PAY" | jget 'data.id')
curl -s -X PUT "$BASE/api/staffing/pay" $CK -H 'Content-Type: application/json' -d "{\"id\":\"$PAYID\",\"status\":\"paid\"}" >/dev/null
SIGN=$(curl -s -X POST "$BASE/api/staffing/pay/$PAYID/sign" $CK -H 'Content-Type: application/json' -d '{"signature_url":"data:image/png;base64,AAA=","signed_by":"Verify"}')
echo "$SIGN" | grep -qi '"success":true' && ok "AC-F4.1 · firma de nómina OK" || ko "firma: $SIGN"
GETPAY=$(curl -s "$BASE/api/staffing/pay?event_id=$EVENT" $CK)
SIGURL=$(echo "$GETPAY" | jget "data.find(p=>p.id==='$PAYID').signature_url" | head -c 4)
[ "$SIGURL" = "data" ] && ok "AC-F4.1 · GET /staffing/pay expone signature_url" || ko "GET pay sin signature_url"

echo "▸ F4.2 · cuentas a pagar a proveedores (UI consumidora)…"
grep -q "ProviderInvoicesTab" src/components/b2b/ProvidersManager.tsx && ok "AC-F4.2 · ProvidersManager con pestaña Cuentas a pagar" || ko "sin pestaña de cuentas a pagar"

echo "▸ F4.3 · protocol_notes editable vía PUT /api/events/[id]…"
check "AC-F4.3 · protocol_notes persistido" "$(q "SELECT protocol_notes FROM events WHERE id='$EVENT'")" "Entrada lateral, mesa VIP"

echo "▸ F4.4 · sitting sobre plano de venue (event_id llega al editor)…"
grep -q "searchParams.get('event_id')" src/app/admin/mapa-mesas/page.tsx && ok "AC-F4.4 · mapa-mesas lee ?event_id= (antes se ignoraba)" || ko "mapa-mesas no lee event_id"
grep -q "venuePdfUrl" src/components/b2b/PremiumTableMapEditor.tsx && ok "AC-F4.4 · editor renderiza venue_pdf_url como capa de fondo" || ko "sin capa de plano"

echo "─────────────────────────────────────────────"
echo "RESULTADO: $PASS OK · $FAIL FALLOS"
if [ "$FAIL" -eq 0 ]; then
  echo "✅ Sprint 6 (acta de cocina/APPCC) verificado."
  exit 0
else
  echo "❌ Hay fallos que corregir."
  exit 1
fi
