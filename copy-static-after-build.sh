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
fi
