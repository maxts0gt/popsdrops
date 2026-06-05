#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

missing=()
for name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
  if [[ -z "${!name:-}" ]] && ! grep -qE "^${name}=" .env.local 2>/dev/null; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Missing required web env vars: %s\n' "${missing[*]}" >&2
  printf 'Create .env.local from .env.local.example using the remote Supabase project URL and anon/publishable key.\n' >&2
  printf 'Dev login also requires SUPABASE_SERVICE_ROLE_KEY.\n' >&2
  exit 1
fi

exec npm run dev
