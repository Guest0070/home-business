#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
RUNTIME="$ROOT/runtime"

mkdir -p "$RUNTIME"

pkill -f "src/server.js" 2>/dev/null || true
pkill -f "vite --host 127.0.0.1 --port 5173" 2>/dev/null || true

(cd "$BACKEND" && nohup node src/server.js > "$RUNTIME/backend.out.log" 2> "$RUNTIME/backend.err.log" &)
sleep 2
(cd "$FRONTEND" && nohup node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 > "$RUNTIME/frontend.out.log" 2> "$RUNTIME/frontend.err.log" &)

echo "Coal TMS is starting."
echo "Frontend: http://127.0.0.1:5173"
echo "Backend:  http://127.0.0.1:4000"
