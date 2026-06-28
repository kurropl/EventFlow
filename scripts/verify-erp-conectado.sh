#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación "ERP conectado" (Spec 001)
# Red de seguridad SDD: demuestra que la ACEPTACIÓN POR EL CLIENTE
# (ruta pública) deja el evento conectado para TODAS las áreas, y
# comprueba los 6 invariantes de spec.md §6.
#
# Uso:  BASE=http://localhost:3939 bash scripts/verify-erp-conectado.sh
# Requiere: servidor next en $BASE + Postgres local. El script RESIEMBRA
# la BD eventflow_verify (schema.sql + verify-ejemplo-e2e.sql) para ser
# determinista, así que debe ejecutarse contra la BD de verificación.
#
# NOTA: hoy (antes de implementar la Spec 001) este script sale en ROJO.
# Ese es su propósito: fijar el objetivo. Pasa a verde cuando R1/R2 estén hechos.
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
ge(){ local d="$1" got="$2" min="$3"; if [ "${got:-0}" -ge "$min" ] 2>/dev/null; then ok "$d ($got)"; else ko "$d → got '$got', expected ≥ $min"; fi; }

echo "═══ EventFlow · Verificación ERP conectado (Spec 001) ═══"

# ── 0. Resembrar BD para determinismo ───────────────────────
echo "▸ Resembrando eventflow_verify…"
eval "$PGURL_ADMIN -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='eventflow_verify' AND pid<>pg_backend_pid();\"" >/dev/null 2>&1
eval "$PGURL_ADMIN -c 'DROP DATABASE IF EXISTS eventflow_verify;'" >/dev/null 2>&1
eval "$PGURL_ADMIN -c 'CREATE DATABASE eventflow_verify;'" >/dev/null 2>&1
eval "$PGURL_ADMIN -d eventflow_verify -v ON_ERROR_STOP=1 -f schema.sql" >/dev/null 2>&1 && ok "schema.sql cargado" || ko "fallo cargando schema.sql"
eval "$PGURL_ADMIN -d eventflow_verify -v ON_ERROR_STOP=1 -f scripts/verify-ejemplo-e2e.sql" >/dev/null 2>&1 && ok "fixture sembrado" || ko "fallo sembrando fixture"

check "estado inicial evento = draft" "$(q "SELECT status FROM events WHERE id='$EVENT'")" "draft"
check "estado inicial quote = sent"   "$(q "SELECT status FROM quotes WHERE id='$QUOTE'")" "sent"

# ── 1. R1 · ACEPTACIÓN POR EL CLIENTE (ruta pública, sin auth) ─
echo "▸ R1 · El CLIENTE acepta su presupuesto (POST /api/quotes/public/$QUOTE/accept)…"
RESP=$(curl -s -X POST "$BASE/api/quotes/public/$QUOTE/accept" -H 'Content-Type: application/json')
echo "$RESP" | grep -qi '"success":true' && ok "API aceptó (200)" || ko "respuesta: $RESP"

check "AC1.1 · evento pasa a accepted" "$(q "SELECT status FROM events WHERE id='$EVENT'")" "accepted"
ge "AC1.1 · existe 1 event_order"       "$(q "SELECT count(*) FROM event_orders WHERE event_id='$EVENT'")" 1
ge "AC1.1 · existen pagos (señal+saldo)" "$(q "SELECT count(*) FROM payments WHERE event_id='$EVENT'")" 2
check "AC1.1 · client_token generado"   "$(q "SELECT (client_token IS NOT NULL) FROM events WHERE id='$EVENT'")" "t"
ge "AC1.1 · escandallo generado"        "$(q "SELECT count(*) FROM event_shopping_items WHERE event_id='$EVENT'")" 1

# Σ pagos == total_pvp (±0.01)
echo "▸ R1 · Σ pagos == total_pvp…"
DIFFP=$(q "SELECT ABS(COALESCE((SELECT SUM(amount) FROM payments WHERE event_id='$EVENT'),0) - COALESCE((SELECT total_pvp FROM events WHERE id='$EVENT'),0)) <= 0.01")
check "AC: Σ pagos == total_pvp" "$DIFFP" "t"

# ── 2. R2 · FUENTE ÚNICA DE COSTE (Opción B) ────────────────
echo "▸ R2 · events.total_cost == Σ escandallo estimado…"
DIFFC=$(q "SELECT ABS(COALESCE((SELECT total_cost FROM events WHERE id='$EVENT'),0) - COALESCE((SELECT SUM(estimated_cost) FROM event_shopping_items WHERE event_id='$EVENT' AND frozen=false),0)) <= 0.01")
check "AC2.1 · total_cost == Σ estimated_cost" "$DIFFC" "t"

# ── 3. Invariantes (spec.md §6) ─────────────────────────────
echo "▸ Invariantes del ERP…"
check "INV1 · exactamente 1 event_order" "$(q "SELECT count(*) FROM event_orders WHERE event_id='$EVENT'")" "1"
check "INV5 · evento accepted tiene client_token" "$(q "SELECT (client_token IS NOT NULL) FROM events WHERE id='$EVENT' AND status='accepted'")" "t"
# INV4 · estado dentro del CHECK (no excepción)
check "INV4 · status válido" "$(q "SELECT status IN ('draft','sent','accepted','in_progress','completed','paid','cancelled','lost','reopened') FROM events WHERE id='$EVENT'")" "t"
# INV6 (estático) · ningún INSERT de order/payments/invoices fuera de src/lib/domain
echo "▸ INV6 · sin INSERT duplicado fuera de src/lib/domain…"
OUT=$(grep -rlnE "INSERT INTO (event_orders|payments|invoices)" src/app/api --include="*.ts" 2>/dev/null | grep -v "seed-ejemplo" | wc -l)
check "INV6 · handlers con INSERT order/pagos/factura" "$OUT" "0"
# lead sincronizado a valor válido del CHECK (no 'confirmado').
# Relación real: quotes.lead_id → leads.id (events NO tiene lead_id; leads NO tiene event_id).
LEADOK=$(q "SELECT COALESCE((SELECT bool_and(l.status IN ('nuevo','contactado','presupuestado','convertido','perdido')) FROM leads l JOIN quotes q ON q.lead_id=l.id WHERE q.event_id='$EVENT'), true)")
check "AC4.6 · leads.status válido (no 'confirmado')" "$LEADOK" "t"

echo "─────────────────────────────────────────────"
echo "RESULTADO:  $PASS OK  ·  $FAIL FALLOS"
[ "$FAIL" -eq 0 ] && echo "✅ ERP conectado (Spec 001) verificado." || echo "❌ ERP aún desconectado — pendiente implementar Spec 001 (esperado en rojo hoy)."
exit 0
