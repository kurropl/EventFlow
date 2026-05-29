#!/bin/sh
# Copy static files to standalone (needed for each build)
cp -r /app/.next/static /app/.next/standalone/.next/static 2>/dev/null || true
# Start the server
exec node /app/.next/standalone/server.js
