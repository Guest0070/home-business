#!/usr/bin/env bash
set -euo pipefail

pkill -f "src/server.js" 2>/dev/null || true

echo "Hosted backend stopped."
