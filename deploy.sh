#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "[C_Ziperr] validate native package..."
npm run validate:native-package || true
echo "[C_Ziperr] regenerate manifests..."
npm run generate:manifest || true
node scripts/generate-integrity.mjs --dir native-game --out native-game/manifests/integrity.json || true
echo "[C_Ziperr] package native..."
npm run package:native || node scripts/package-native-game.js || true
echo "[C_Ziperr] deploy worker..."
npx wrangler deploy
echo "Deployed. Health: curl -sS \"\${WORKER_URL:-https://c-zipper.corelink-ai.workers.dev}/api/health\""
