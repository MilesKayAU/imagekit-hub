#!/usr/bin/env bash
# Build the Chrome Web Store / GitHub Release zip from the extension/ folder.
# Usage: bash scripts/package.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/readycode-imagekit.zip"

rm -f "$OUT"
cd "$ROOT/extension"
zip -r "$OUT" . -x "*.DS_Store" "*.map"
echo "Wrote $OUT"