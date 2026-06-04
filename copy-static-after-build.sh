#!/bin/sh
# Next.js `output: standalone` does NOT copy `.next/static` NOR `public/` into
# the standalone build. Both must be placed inside .next/standalone so the
# bind-mounted container (node server.js) can serve them. Run this after every
# `npm run build`. Idempotent: safe to re-run.
if [ -d ".next/standalone" ]; then
  # Client JS/CSS chunks
  if [ -d ".next/static" ]; then
    mkdir -p .next/standalone/.next
    rm -rf .next/standalone/.next/static
    cp -r .next/static .next/standalone/.next/static
    echo "Copied .next/static -> standalone"
  fi
  # Public assets (hero poster, space images, etc.)
  if [ -d "public" ]; then
    rm -rf .next/standalone/public
    cp -r public .next/standalone/public
    echo "Copied public/ -> standalone"
  fi
  # Copy missing node_modules (Next.js standalone sometimes drops them)
  if [ -d "node_modules" ] && [ -d ".next/standalone/node_modules" ]; then
    cp -r node_modules/* .next/standalone/node_modules/ 2>/dev/null
    echo "Copied node_modules -> standalone"
  fi
fi
