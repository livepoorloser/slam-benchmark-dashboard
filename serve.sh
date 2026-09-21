#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
python3 scripts/build_data.py
PORT="${1:-8080}"
echo "Open: http://127.0.0.1:${PORT}"
python3 -m http.server "$PORT"
