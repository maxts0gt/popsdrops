#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/../mobile" || exit 1
exec npm run web -- --port 8081
