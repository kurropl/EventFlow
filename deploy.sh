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

echo "▶ 5/6  reinicio del contenedor (force-recreate)"
# IMPORTANTE: 'npm run build' borra y recrea .next/standalone (inode nuevo). Un
# contenedor que siga vivo mantiene el bind-mount apuntando al directorio viejo
# ya borrado: el server en memoria sirve el HTML pero NO puede leer del disco los
# estáticos -> 404 en /_next/static y /images. --force-recreate vuelve a resolver
# el montaje al directorio nuevo. (Un simple 'restart' NO lo arregla.)
docker compose up -d --force-recreate eventflow

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
  echo "❌ DESPLIEGUE CON ASSETS ROTOS — diagnóstico:"
  echo "--- HOST: .next/standalone/.next/static ---"
  ls -la .next/standalone/.next/static 2>&1 | head -5
  echo "--- HOST: .next/standalone/public/images ---"
  ls -la .next/standalone/public/images 2>&1 | head -5
  echo "--- CONTENEDOR: /app/.next/static ---"
  docker compose exec -T eventflow ls -la /app/.next/static 2>&1 | head -5
  echo "--- CONTENEDOR: /app/public/images ---"
  docker compose exec -T eventflow ls -la /app/public/images 2>&1 | head -5
  echo ""
  echo "Si en HOST existen pero en CONTENEDOR no: el montaje quedó obsoleto."
  echo "Ejecuta:  docker compose down eventflow && docker compose up -d eventflow"
  echo "Si tampoco están en HOST: re-ejecuta 'npm run build' (postbuild copia estáticos)."
  exit 1
fi
echo ""
echo "✅ Despliegue OK — HTML, CSS, JS e imágenes sirviendo correctamente."
