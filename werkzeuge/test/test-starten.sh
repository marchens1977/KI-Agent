#!/usr/bin/env bash
# Startet die automatische Prüfung der App.
# Aufruf im Projektordner:  bash werkzeuge/test/test-starten.sh
# Voraussetzung: Node.js mit Playwright und Chromium (in Claudes Arbeitsumgebung vorhanden).
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT="${PORT:-8765}"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1
PORT="$PORT" node werkzeuge/test/test-ki.js
