#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación Sprint 5 · Auditoría y unificación UI/UX
#
# C1-C2 (sistema de diseño): verificación estática — cero hex sueltos en
# los ficheros migrados, cero duplicación icon="string" (bug real
# encontrado y corregido).
# C3 (features de UI sobre backend): verificación funcional vía API de
# las capacidades que ahora tienen UI (venue_slug expuesto, toggle de
# stock persistido, ownership de leads expuesto).
# C4 (traducción): grep de los 3 fixes.
#
# La verificación VISUAL (ausencia de la caja negra en Cocina, título
# con fuente serif, botón dorado, etc.) se hizo con Playwright durante
# el desarrollo (capturas de pantalla) — no se automatiza aquí para no
# depender de un navegador en el pipeline de regresión.
#
# Uso:  BASE=http://localhost:3939 bash scripts/verify-sprint5-ui.sh
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

echo "═══ EventFlow · Sprint 5 · Auditoría y unificación UI/UX ═══"

# ════════════════════════════════════════════════════════════
# C1/C2 · Sistema de diseño — verificación estática
# ════════════════════════════════════════════════════════════
echo "▸ C1/C2 · cero hex de los roles unificados (ink/muted/danger/gold-amber) en los ficheros migrados…"
# No se exige cero hex absoluto: quedan intencionalmente paletas categóricas
# (identidad de columna Kanban, categorías de proveedor) y gradientes de marca
# inline — solo se exige que los roles YA unificados (texto principal, texto
# secundario, error, dorado-como-amber) no reaparezcan.
MIGRATED_FILES="src/components/ui/button.tsx src/components/ui/PageHeader.tsx src/components/ui/EmptyState.tsx src/components/b2b/TrazabilidadPanel.tsx src/components/b2b/EventDetail.tsx src/components/b2b/BillingPanel.tsx src/components/b2b/ProvidersManager.tsx src/components/b2b/LeadsCRM.tsx src/components/b2b/CocinaPanel.tsx src/app/admin/rentabilidad/page.tsx src/app/admin/confirmacion/page.tsx src/app/admin/config/page.tsx"
ROLE_HEX_COUNT=0
for f in $MIGRATED_FILES; do
  c=$(grep -oE "#(1A1A1A|1A1A2E|1A1208|9CA3AF|6B7280|DC2626)" "$f" 2>/dev/null | wc -l)
  ROLE_HEX_COUNT=$((ROLE_HEX_COUNT + c))
done
check "AC-C1.1 · 0 hex de ink/muted/danger en 12 ficheros migrados" "$ROLE_HEX_COUNT" "0"

echo "▸ C1 · tokens de estado semántico en tailwind.config.ts…"
grep -q "success:" tailwind.config.ts && grep -q "warning:" tailwind.config.ts && grep -q "danger:" tailwind.config.ts \
  && ok "AC-C1.2 · success/warning/danger definidos" || ko "AC-C1.2 · faltan tokens semánticos"

echo "▸ C1 · ui/button.tsx usa la marca (gold), no amber genérico…"
grep -q "bg-amber-600" src/components/ui/button.tsx \
  && ko "AC-C1.3 · button.tsx sigue con amber-600" \
  || ok "AC-C1.3 · button.tsx usa gold"

echo "▸ C2 · bug real corregido: EmptyState icon=\"string\" (antes se veía como texto plano)…"
STRING_ICON_COUNT=$(grep -rE 'icon="[a-zA-Z]+"' src --include="*.tsx" 2>/dev/null | wc -l)
check "AC-C2.1 · 0 ocurrencias de icon=\"string\" en toda la app" "$STRING_ICON_COUNT" "0"

# ── 0. Resembrar BD para C3 (checks funcionales) ─────────────
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
# C3 · Features de UI sobre backend — verificación funcional
# ════════════════════════════════════════════════════════════
echo "▸ C3.1 · selector de salón (venue_slug expuesto en GET, antes solo venue_id)…"
curl -s -X PUT "$BASE/api/events/$EVENT" $AC -H 'Content-Type: application/json' -d '{"venue":"salon-arriba"}' >/dev/null
VENUE_SLUG=$(curl -s "$BASE/api/events/$EVENT" $AC | jget 'data.venue_slug')
check "AC-C3.1 · venue_slug resuelto tras asignar salón" "$VENUE_SLUG" "salon-arriba"

echo "▸ C3.2 · margen real con coste de personal (laborCostPaid en /api/rentabilidad)…"
curl -s -X PUT "$BASE/api/quotes/$QUOTE" $AC -H 'Content-Type: application/json' -d '{"status":"accepted"}' >/dev/null
RENTA=$(curl -s "$BASE/api/rentabilidad" $AC)
HAS_LABOR=$(echo "$RENTA" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const row=(j.data||[]).find(e=>e.id==='$EVENT');console.log(row && 'laborCostPaid' in row ? 'yes':'no')}catch(e){console.log('ERR')}})")
check "AC-C3.2 · laborCostPaid presente en la respuesta (ahora mostrado en rentabilidad)" "$HAS_LABOR" "yes"

echo "▸ C3.3/C3.4 · toggle block_accept_on_stock_shortage persiste vía /api/settings…"
curl -s -X PUT "$BASE/api/settings" $AC -H 'Content-Type: application/json' -d '{"block_accept_on_stock_shortage":true}' >/dev/null
TOGGLE=$(curl -s "$BASE/api/settings" $AC | jget 'data.block_accept_on_stock_shortage')
check "AC-C3.4 · toggle persistido (antes la columna existía sin UI)" "$TOGGLE" "true"
curl -s -X PUT "$BASE/api/settings" $AC -H 'Content-Type: application/json' -d '{"block_accept_on_stock_shortage":false}' >/dev/null

echo "▸ C3.7 · badge de propietario (assigned_to_name expuesto en GET /api/leads)…"
CREATE=$(curl -s -X POST "$BASE/api/admin/users" $AC -H 'Content-Type: application/json' -d '{"email":"comercial5@verify.test","name":"Comercial Cinco","password":"comercial123","role":"admin"}')
COMTOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"comercial5@verify.test","password":"comercial123"}' | jget 'token')
COMAC="-H Cookie:eventflow_token=$COMTOKEN"
curl -s -X POST "$BASE/api/leads" $COMAC -H 'Content-Type: application/json' -d '{"name":"Lead UI VERIFY","email":"leadui@verify.test"}' >/dev/null
LEADS_LIST=$(curl -s "$BASE/api/leads" $AC)
OWNER_NAME=$(echo "$LEADS_LIST" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const row=(j.data||[]).find(l=>l.email==='leadui@verify.test');console.log(row && row.assigned_to_name || '')}catch(e){console.log('ERR')}})")
check "AC-C3.7 · assigned_to_name resuelto (badge de propietario en LeadsCRM)" "$OWNER_NAME" "Comercial Cinco"

echo "▸ C3.7 · filtro \"mis leads\" (?assigned_to=) devuelve solo los del propietario…"
COMID=$(q "SELECT id FROM admins WHERE email='comercial5@verify.test'")
MY_LEADS=$(curl -s "$BASE/api/leads?assigned_to=$COMID" $AC | jget 'data.length')
check "AC-C3.7 · filtro assigned_to devuelve 1 lead" "$MY_LEADS" "1"

echo "▸ C3.5 · botón Generar contrato (POST /api/events/[id]/contract/generate ya servía esto, ahora con botón)…"
GEN=$(curl -s -X POST "$BASE/api/events/$EVENT/contract/generate" $AC)
echo "$GEN" | grep -qi '"success":true' && ok "AC-C3.5 · generación de contrato accesible (botón en EventDetail)" || ko "generate: $GEN"

echo "▸ C3.9 · reserva de equipamiento accesible (GET checkout, ahora con panel en Cocina)…"
CHK=$(curl -s "$BASE/api/cocina/equipment/checkout/$EVENT" $AC)
echo "$CHK" | grep -qi '"success":true' && ok "AC-C3.9 · endpoint de checkout accesible" || ko "checkout: $CHK"

echo "▸ C3.10 · facturación parcial/posterior (POST /api/events/[id]/invoice, ahora con botón)…"
curl -s -X POST "$BASE/api/events/$EVENT/close" $AC -H 'Content-Type: application/json' -d '{"invoiceAmount":1000}' >/dev/null
INV2=$(curl -s -X POST "$BASE/api/events/$EVENT/invoice" $AC -H 'Content-Type: application/json' -d '{"amount":500}')
echo "$INV2" | grep -qi '"success":true' && ok "AC-C3.10 · 2ª factura parcial accesible (botón en EventDetail)" || ko "invoice: $INV2"

# ════════════════════════════════════════════════════════════
# C4 · Traducción
# ════════════════════════════════════════════════════════════
echo "▸ C4 · los 3 fixes de traducción…"
grep -q "label: 'Resumen'" src/components/b2b/HACCPPanel.tsx && ok "AC-C4.1 · HACCPPanel 'Dashboard'→'Resumen'" || ko "AC-C4.1 · sigue en inglés"
grep -q '"sr-only">Cerrar<' src/components/ui/dialog.tsx && grep -q '"sr-only">Cerrar<' src/components/ui/sheet.tsx \
  && ok "AC-C4.2 · dialog.tsx/sheet.tsx 'Close'→'Cerrar'" || ko "AC-C4.2 · sigue en inglés"
grep -q "sanitizeError" src/app/api/floor-plan/generate/route.ts && ok "AC-C4.3 · floor-plan/generate usa sanitizeError" || ko "AC-C4.3 · no usa sanitizeError"

# ── Resultado ────────────────────────────────────────────────
echo "─────────────────────────────────────────────"
echo "RESULTADO:  $PASS OK  ·  $FAIL FALLOS"
[ "$FAIL" -eq 0 ] && echo "✅ Sprint 5 (UI/UX) verificado." || echo "❌ Hay fallos que corregir."
[ "$FAIL" -eq 0 ]
