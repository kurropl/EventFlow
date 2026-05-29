#!/bin/sh
# Next.js standalone mode doesn't copy .next/static to standalone by default
# This script fixes that after npm run build
if [ -d ".next/standalone" ] && [ -d ".next/static" ]; then
  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/static
  echo "Static files copied to standalone"
fi
