#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "[C_Ziperr V2] Starting 100% offline server on :4173 ..."
echo "  directory: $ROOT"
exec python3 -m http.server 4173 --directory "$ROOT"
