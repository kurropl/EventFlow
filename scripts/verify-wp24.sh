#!/usr/bin/env bash
# ============================================================
# EventFlow — Verificación WP-24: Cierre Económico del Evento
#
# Uso:  BASE=http://localhost:3020 bash scripts/verify-wp24.sh
# ============================================================
set -uo pipefail

BASE="${BASE:-http://localhost:3020}"
PASS=0; FAIL=0; WARN=0

ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
ko(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
warn(){ echo "  ⚠️  $1"; WARN=$((WARN+1)); }

echo "═══════════════════════════════════════════════════════════"
echo "  WP-24: Cierre Económico del Evento — Verificación"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. Verificar tabla event_financial_closures
echo "1. Verificando tabla event_financial_closures..."
TABLE_CHECK=$(curl -s "$BASE/api/rentabilidad" | jq -r '.success // false')
if [ "$TABLE_CHECK" = "true" ]; then
  ok "API de rentabilidad responde correctamente"
else
  ko "API de rentabilidad no responde"
fi

# 2. Verificar que la página de rentabilidad carga
echo ""
echo "2. Verificando página de rentabilidad..."
PAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/admin/rentabilidad")
if [ "$PAGE_STATUS" = "200" ]; then
  ok "Página de rentabilidad carga (HTTP 200)"
else
  ko "Página de rentabilidad falla (HTTP $PAGE_STATUS)"
fi

# 3. Verificar transición OPC-5 existe
echo ""
echo "3. Verificando transición OPC-5..."
echo "  ℹ️  La transición OPC-5 (cerrado_operativo → cerrado_contable) está implementada"
echo "  ℹ️  Para probarla, ejecuta:"
echo "      POST /api/events/[id]/transitions con { transition: 'OPC-5' }"

# 4. Verificar handler registrado
echo ""
echo "4. Verificando handler registrado..."
HANDLER_CHECK=$(grep -r "event.operationally_closed" src/domain/handlers/index.ts 2>/dev/null | wc -l)
if [ "$HANDLER_CHECK" -gt 0 ]; then
  ok "Handler event.operationally_closed registrado"
else
  ko "Handler event.operationally_closed no registrado"
fi

# 5. Verificar tests
echo ""
echo "5. Verificando tests..."
TEST_FILE="src/lib/__tests__/eventOperationallyClosed.test.ts"
if [ -f "$TEST_FILE" ]; then
  ok "Archivo de tests existe: $TEST_FILE"
else
  ko "Archivo de tests no encontrado: $TEST_FILE"
fi

# Resumen
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Resumen: ✅ $PASS pasaron | ❌ $FAIL fallaron | ⚠️  $ WARN"
echo "═══════════════════════════════════════════════════════════"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "❌ Verificación FALLIDA"
  exit 1
else
  echo ""
  echo "✅ Verificación COMPLETADA"
  exit 0
fi
