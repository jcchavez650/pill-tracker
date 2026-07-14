#!/usr/bin/env bash
# Production start for Railway (or any Node host).
# Waits for the database, syncs the schema, then starts Next.js.
set -uo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "✗ DATABASE_URL is not set. On Railway, add a PostgreSQL database and set"
  echo "  DATABASE_URL to reference it, e.g. \${{Postgres.DATABASE_URL}}."
  exit 1
fi

echo "→ Syncing database schema (prisma db push)…"
attempt=1
max=8
until npx prisma db push --skip-generate; do
  if [ "$attempt" -ge "$max" ]; then
    echo "✗ Could not reach the database after $attempt attempts."
    echo "  Check that the PostgreSQL service is running and DATABASE_URL is correct."
    exit 1
  fi
  echo "…database not ready (attempt $attempt/$max); retrying in 5s…"
  attempt=$((attempt + 1))
  sleep 5
done

echo "→ Starting Next.js on 0.0.0.0:${PORT:-3000}…"
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
