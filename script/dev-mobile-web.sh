#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/mobile"

missing=()
for name in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY; do
  if [[ -z "${!name:-}" ]] && ! grep -qE "^${name}=" .env.local 2>/dev/null; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Missing required mobile env vars: %s\n' "${missing[*]}" >&2
  printf 'Create mobile/.env.local from mobile/.env.local.example using the remote Supabase project URL and anon/publishable key.\n' >&2
  exit 1
fi

exec npm run web -- --port 8081
