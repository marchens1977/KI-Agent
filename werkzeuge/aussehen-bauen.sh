#!/usr/bin/env bash
# Baut das Aussehen (Tailwind CSS) neu und setzt es fest in index.html ein.
# Nötig, wenn in index.html neue Tailwind-Klassen (z. B. "bg-slate-800", "mt-3") dazukommen.
# Aufruf im Projektordner:  bash werkzeuge/aussehen-bauen.sh
set -euo pipefail
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. index.html ohne den bisher eingebauten Stil-Block untersuchen lassen
python3 - "$TMP/inhalt.html" <<'PY'
import re, sys
s = open('index.html', encoding='utf-8').read()
s = re.sub(r'/\* TAILWIND-START \*/.*?/\* TAILWIND-END \*/', '', s, flags=re.S)
open(sys.argv[1], 'w', encoding='utf-8').write(s)
PY

# 2. Nur die tatsächlich benutzten Klassen erzeugen (Tailwind 3.4.19, wie das frühere CDN)
KI_INHALT="$TMP/inhalt.html" npx --yes tailwindcss@3.4.19 \
  -c werkzeuge/tailwind.config.js -i werkzeuge/tailwind-eingabe.css \
  --minify -o "$TMP/aussehen.css"

# 3. Ergebnis zwischen die Markierungen in index.html einsetzen
python3 - "$TMP/aussehen.css" <<'PY'
import re, sys
css = open(sys.argv[1], encoding='utf-8').read().strip()
s = open('index.html', encoding='utf-8').read()
neu, n = re.subn(r'/\* TAILWIND-START \*/.*?/\* TAILWIND-END \*/',
                 lambda m: '/* TAILWIND-START */' + css + '/* TAILWIND-END */', s, flags=re.S)
if n != 1:
    sys.exit('Markierungen TAILWIND-START/-END nicht gefunden.')
open('index.html', 'w', encoding='utf-8').write(neu)
print(f'Aussehen eingebaut: {len(css)//1024} KB')
PY
