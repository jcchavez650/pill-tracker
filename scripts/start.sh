#!/usr/bin/env bash
# Production start for Railway (or any Node host).
# Ensures the database schema exists on the mounted volume, then starts Next.js.
set -e

echo "→ Syncing database schema (prisma db push)…"
npx prisma db push --skip-generate

echo "→ Starting Next.js on port ${PORT:-3000}…"
exec npx next start -p "${PORT:-3000}"
