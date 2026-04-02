#!/bin/bash
export PATH="/Users/max/.nvm/versions/node/v22.13.1/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
exec /Users/max/.nvm/versions/node/v22.13.1/bin/node node_modules/next/dist/bin/next dev --webpack
