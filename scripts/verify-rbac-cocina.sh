#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación E2E de RBAC + Guía de Cocina (venue-aware)
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
login(){ curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "$1" | jget 'token'; }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "═══ EventFlow · RBAC + Guía de Cocina ═══"

# ── Login admin (env) ───────────────────────────────────────
ADMIN=$(login '{"username":"admin","password":"verify123"}')
[ -n "$ADMIN" ] && [ "$ADMIN" != "ERR" ] && ok "admin login" || { ko "admin login"; exit 1; }
AC="-H Cookie:eventflow_token=$ADMIN"

# Aceptar presupuesto para tener escandallo (FWD-2)
curl -s -X PUT "$BASE/api/quotes/$QUOTE" $AC -H 'Content-Type: application/json' -d '{"status":"accepted"}' >/dev/null

# ── RBAC · crear usuario cocina vía API de admin (FR-R04) ───
echo "▸ Gestión de usuarios (FR-R04)…"
CREATE=$(curl -s -X POST "$BASE/api/admin/users" $AC -H 'Content-Type: application/json' \
  -d '{"email":"chef@verify.test","name":"Chef","password":"chef123","role":"cocina"}')
echo "$CREATE" | grep -q '"success":true' && ok "admin crea usuario cocina" || ko "crear usuario: $CREATE"

# ── RBAC · login como cocina y enforcement ──────────────────
echo "▸ Enforcement por perfil (FR-R02)…"
CHEF=$(login '{"username":"chef@verify.test","password":"chef123"}')
[ -n "$CHEF" ] && [ "$CHEF" != "ERR" ] && ok "login usuario cocina" || ko "login cocina"
CC="-H Cookie:eventflow_token=$CHEF"

check_code(){ local d="$1" got="$2" exp="$3"; [ "$got" = "$exp" ] && ok "$d ($got)" || ko "$d → $got (esperado $exp)"; }
# cocina NO puede presupuestos ni nóminas (criterio de aceptación del spec)
check_code "cocina → /api/quotes = 403"        "$(code $CC "$BASE/api/quotes/$QUOTE")" "403"
check_code "cocina → /api/staffing/pay = 403"  "$(code $CC -X POST "$BASE/api/staffing/pay")" "403"
check_code "cocina → /api/clients = 403"       "$(code $CC "$BASE/api/clients")" "403"
# cocina SÍ puede su módulo
check_code "cocina → /api/cocina/guia = 200"   "$(code $CC "$BASE/api/cocina/guia/$EVENT")" "200"
check_code "cocina → /api/escandallo = 200"    "$(code $CC "$BASE/api/escandallo/event/$EVENT")" "200"
# admin puede todo
check_code "admin → /api/quotes = 200"         "$(code $AC "$BASE/api/quotes/$QUOTE")" "200"
# sin token → 401
check_code "anónimo → /api/cocina/guia = 401"  "$(code "$BASE/api/cocina/guia/$EVENT")" "401"

# ── Guía de Cocina · venue = benitez (por defecto) ──────────
echo "▸ Guía de Cocina · evento en el LOCAL (benitez)…"
curl -s -X PUT "$BASE/api/events/$EVENT" $AC -H 'Content-Type: application/json' -d '{"venue_type":"benitez"}' >/dev/null
G=$(curl -s "$BASE/api/cocina/guia/$EVENT" $AC)
check_code "venue tipo = benitez"  "$(echo "$G" | jget 'data.venue.tipo')" "benitez"
CARGA_AP=$(echo "$G" | jget "data.fases.find(f=>f.key=='carga').aplica")
check_code "fase CARGA no aplica en local" "$CARGA_AP" "false"
ESC_EST=$(echo "$G" | jget "data.fases.find(f=>f.key=='escandallo_teorico').estado")
check_code "escandallo teórico listo (tras aceptar)" "$ESC_EST" "listo"

# ── Guía de Cocina · venue = externo ────────────────────────
echo "▸ Guía de Cocina · ubicación EXTERNA…"
curl -s -X PUT "$BASE/api/events/$EVENT" $AC -H 'Content-Type: application/json' -d '{"venue_type":"externo","location":"Finca La Pradera"}' >/dev/null
G=$(curl -s "$BASE/api/cocina/guia/$EVENT" $AC)
check_code "venue tipo = externo"  "$(echo "$G" | jget 'data.venue.tipo')" "externo"
CARGA_AP=$(echo "$G" | jget "data.fases.find(f=>f.key=='carga').aplica")
check_code "fase CARGA aplica en externo" "$CARGA_AP" "true"
SIT_EST=$(echo "$G" | jget "data.fases.find(f=>f.key=='sitting').estado")
check_code "sitting pendiente (falta PDF venue)" "$SIT_EST" "pendiente"
LOG_EQ=$(echo "$G" | jget "data.fases.find(f=>f.key=='logistica').detalle.incluye_equipamiento")
check_code "logística incluye transporte de equipamiento" "$LOG_EQ" "true"
UBI=$(echo "$G" | jget 'data.venue.ubicacion')
check_code "ubicación registrada" "$UBI" "Finca La Pradera"

# ── Escandallo teórico↔real (FR-C01/C03) ────────────────────
echo "▸ Escandallo teórico↔real…"
E=$(curl -s "$BASE/api/escandallo/$EVENT" $AC)
check_code "estado escandallo = activo"        "$(echo "$E" | jget 'escandallo.estado')" "activo"
check_code "coste estimado = 960.24"           "$(echo "$E" | jget 'escandallo.totales.coste_estimado')" "960.24"
# Registrar consumo real del solomillo (id de la línea)
LINE=$(echo "$E" | jget "escandallo.lineas.find(l=>l.ingrediente=='Solomillo VERIFY').id")
curl -s -X PUT "$BASE/api/escandallo/$EVENT" $AC -H 'Content-Type: application/json' \
  -d "{\"items\":[{\"id\":\"$LINE\",\"actual_quantity\":25000}]}" >/dev/null
E2=$(curl -s "$BASE/api/escandallo/$EVENT" $AC)
check_code "coste real solomillo = 1000 (25000×0,04)" "$(echo "$E2" | jget "escandallo.lineas.find(l=>l.ingrediente=='Solomillo VERIFY').coste_real")" "1000"
check_code "desviación solomillo = +40"        "$(echo "$E2" | jget "escandallo.lineas.find(l=>l.ingrediente=='Solomillo VERIFY').desviacion_coste")" "40"

# ── Hojas venue-aware (FR-C06/C07) ──────────────────────────
echo "▸ Hojas de carga/logística según ubicación…"
curl -s -X PUT "$BASE/api/events/$EVENT" $AC -H 'Content-Type: application/json' -d '{"venue_type":"benitez"}' >/dev/null
LB=$(curl -s "$BASE/api/cocina/event/$EVENT/loading" $AC)
check_code "carga NO aplica en local"          "$(echo "$LB" | jget 'sheet.applies')" "false"
GB=$(curl -s "$BASE/api/cocina/event/$EVENT/logistics" $AC)
check_code "logística sin transporte equip. en local" "$(echo "$GB" | jget 'sheet.includesEquipmentTransport')" "false"
curl -s -X PUT "$BASE/api/events/$EVENT" $AC -H 'Content-Type: application/json' -d '{"venue_type":"externo"}' >/dev/null
LX=$(curl -s "$BASE/api/cocina/event/$EVENT/loading" $AC)
check_code "carga SÍ aplica en externo"        "$(echo "$LX" | jget 'sheet.applies')" "true"
GX=$(curl -s "$BASE/api/cocina/event/$EVENT/logistics" $AC)
check_code "logística CON transporte equip. en externo" "$(echo "$GX" | jget 'sheet.includesEquipmentTransport')" "true"

# ── Cierre: escandallo cerrado + desviación persistida ──────
echo "▸ Cierre · snapshot de desviación…"
curl -s -X POST "$BASE/api/events/$EVENT/close" $AC -H 'Content-Type: application/json' -d '{}' >/dev/null
check_code "escandallo → cerrado"              "$(curl -s "$BASE/api/escandallo/$EVENT" $AC | jget 'escandallo.estado')" "cerrado"
check_code "event_cost_deviations persistido"  "$(q "SELECT count(*) FROM event_cost_deviations WHERE event_id='$EVENT'")" "1"
check_code "desviación total = 40 (real 1000+0.24 vs est 960.24)" "$(q "SELECT deviation_amount FROM event_cost_deviations WHERE event_id='$EVENT'")" "40.00"

# ── Import de recetas Excel/CSV con merma (FR-C10) ──────────
echo "▸ Import de recetas (preview + commit)…"
CSV=/tmp/recetas-verify.csv
printf 'plato,categoria,ingrediente,cantidad,unidad,merma_%%,notas\nPaella VERIFY,arroz,Arroz VERIFY,100,g,0,\nPaella VERIFY,arroz,Azafran VERIFY,1,g,0,\n' > "$CSV"
PV=$(curl -s -X POST "$BASE/api/cocina/recipes/import" $AC -F "file=@$CSV")
check_code "preview: 1 receta"            "$(echo "$PV" | jget 'recetas')" "1"
check_code "preview: 2 ingredientes nuevos" "$(echo "$PV" | jget 'ingredientes_nuevos')" "2"
CM=$(curl -s -X POST "$BASE/api/cocina/recipes/import?commit=1" $AC -F "file=@$CSV")
check_code "commit: 1 plato creado"       "$(echo "$CM" | jget 'platos_creados')" "1"
check_code "commit: 2 ingredientes creados" "$(echo "$CM" | jget 'ingredientes_creados')" "2"
check_code "recipe_items creados (2)"     "$(q "SELECT count(*) FROM recipe_items ri JOIN catalog_items ci ON ci.id=ri.catalog_item_id WHERE ci.name='Paella VERIFY'")" "2"
# merma: 100 g netos con 0% = 100 g; comprobamos que la cantidad se guardó
check_code "cantidad receta arroz = 100"  "$(q "SELECT ri.quantity::int FROM recipe_items ri JOIN ingredients i ON i.id=ri.ingredient_id WHERE i.name='Arroz VERIFY'")" "100"

echo "─────────────────────────────────────────────"
echo "RESULTADO:  $PASS OK  ·  $FAIL FALLOS"
[ "$FAIL" -eq 0 ] && echo "✅ RBAC + Guía de Cocina correctos." || echo "❌ Hay fallos que corregir."
exit "$FAIL"
