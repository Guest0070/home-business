#!/usr/bin/env bash
set -euo pipefail

pkill -f "src/server.js" 2>/dev/null || true
pkill -f "vite --host 127.0.0.1 --port 5173" 2>/dev/null || true

echo "Coal TMS stopped."
