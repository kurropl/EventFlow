#!/bin/sh
# ============================================================
# EventFlow — despliegue todo-en-uno para el VPS (idempotente)
#   Uso:  sh deploy.sh
# Hace, en el orden correcto:
#   1. git pull
#   2. npm install (si cambian dependencias)
#   3. npm run build  (postbuild copia .next/static + public/ al standalone)
#   4. migración de BD (crea tablas de los módulos BodaLab; idempotente)
#   5. reinicio del contenedor
#   6. AUTOVERIFICACIÓN: HTML + un asset .css + un .js deben dar 200
# Si la verificación falla, termina con error (no deja la web rota en silencio).
# ============================================================
set -e

APP_PORT="${APP_PORT:-3020}"          # puerto host del contenedor eventflow
PG_SERVICE="${PG_SERVICE:-postgres}"  # nombre del servicio postgres en compose
DB_NAME="${DB_NAME:-eventflow}"

echo "▶ 1/6  git pull"
git pull origin main

echo "▶ 2/6  dependencias"
npm install --no-audit --no-fund

echo "▶ 3/6  build (+ copia automática de estáticos)"
npm run build
# Cinturón y tirantes: re-copiar por si se ejecutó build sin postbuild
sh copy-static-after-build.sh

echo "▶ 4/6  migración de base de datos (módulos BodaLab)"
if [ -f scripts/bodalab-modules.sql ]; then
  docker compose exec -T "$PG_SERVICE" psql -U postgres -d "$DB_NAME" < scripts/bodalab-modules.sql \
    && echo "   migración aplicada" \
    || echo "   ⚠ no se pudo aplicar la migración automáticamente; ejecútala a mano"
fi

echo "▶ 5/6  reinicio del contenedor"
docker compose up -d eventflow

echo "▶ 6/6  verificación de estáticos"
sleep 4
BASE="http://localhost:${APP_PORT}"
HTML="$(curl -s "$BASE/")"
CSS="$(printf '%s' "$HTML" | grep -oE '/_next/static/[^\"]+\.css' | head -1)"
JS="$(printf '%s' "$HTML" | grep -oE '/_next/static/[^\"]+\.js' | head -1)"

fail=0
check() {
  code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE$1")"
  if [ "$code" = "200" ]; then echo "   ✓ 200  $1"; else echo "   ✗ $code  $1"; fail=1; fi
}
[ -n "$CSS" ] && check "$CSS" || { echo "   ✗ el HTML no referencia ningún CSS"; fail=1; }
[ -n "$JS" ]  && check "$JS"  || { echo "   ✗ el HTML no referencia ningún JS"; fail=1; }
check "/images/hero-poster.svg"

if [ "$fail" = "1" ]; then
  echo ""
  echo "❌ DESPLIEGUE CON ASSETS ROTOS. Revisa que .next/standalone/.next/static exista"
  echo "   y que el proxy inverso enrute /_next/ y /images/ al contenedor (puerto ${APP_PORT})."
  exit 1
fi
echo ""
echo "✅ Despliegue OK — HTML, CSS, JS e imágenes sirviendo correctamente."
