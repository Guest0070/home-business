#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
RUNTIME="$ROOT/runtime"

mkdir -p "$RUNTIME"

pkill -f "src/server.js" 2>/dev/null || true

(cd "$FRONTEND" && node ./node_modules/vite/bin/vite.js build)
sleep 1
(cd "$BACKEND" && SERVE_FRONTEND=true NODE_ENV=production nohup node src/server.js > "$RUNTIME/backend.out.log" 2> "$RUNTIME/backend.err.log" &)

echo "Hosted mode is running."
echo "Open: http://127.0.0.1:4000"
