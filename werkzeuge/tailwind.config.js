// Einstellungen für das Aussehen (Tailwind CSS, Version 3).
// Wird nur vom Bau-Werkzeug "aussehen-bauen.sh" benutzt – die App selbst lädt nichts davon.
// Farben im Stil der New York Mets: "slate" = Dunkelblau-Töne,
// "blue" = Orange (Hauptfarbe), "indigo" = Mets-Blau.
module.exports = {
  content: [process.env.KI_INHALT || './index.html'],
  theme: { extend: { colors: {
    slate:  { 50:'#f2f5fb',100:'#e6ebf5',200:'#cdd6ea',300:'#a9b6d4',400:'#8494bb',500:'#5f6f99',600:'#44547c',700:'#2c3a5e',800:'#1c2847',900:'#121b33',950:'#0a1020' },
    blue:   { 50:'#fff4ed',100:'#ffe6d5',200:'#ffc9a8',300:'#ffa36f',400:'#ff7a3a',500:'#ff5910',600:'#e64a06',700:'#bf3a08',800:'#98300f',900:'#7a2a10',950:'#421206' },
    indigo: { 50:'#eef3ff',100:'#dbe5ff',200:'#bfd0ff',300:'#93b0ff',400:'#6e9bff',500:'#3d6fe6',600:'#1f4fc4',700:'#0f3c9e',800:'#002d72',900:'#012258',950:'#011538' }
  } } }
};
