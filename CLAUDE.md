# Projekt-Tagebuch: KI-Agent

Dieses Tagebuch hilft Claude (und dem Nutzer), in jeder neuen Sitzung schnell
zu wissen, worum es geht, was schon erledigt ist und wie wir zusammenarbeiten.

## 1. Worum es in der App geht

Der **KI-Agent** ist ein persönlicher E-Mail-Assistent als Webseite.
Er nutzt wahlweise die KI **Google Gemini** oder **Claude (Anthropic)** und ist mit **Gmail** verbunden.

Was die App kann:
- E-Mails mit KI-Hilfe schreiben, prüfen und senden
- Den Nachrichtenverlauf des Assistenten-Kontos anzeigen (Posteingang und Gesendet)
- Dokumente hochladen oder Text einfügen und von der KI auswerten lassen
- Eine Rolle, einen Schreibstil und Grundinformationen für die KI festlegen
- E-Mail-Signatur und Grußformel einstellen
- Zugangsdaten verwalten, getrennt nach Konten (Kontotrennung)
- **Adressbuch im Reiter „E-Mail“** (Knopf „Adressbuch“ beim Empfänger): Kontakte suchen, antippen
  = Empfänger übernehmen, „Ändern“ (Name und Adresse), „+ Neu“, löschen (mit Rückfrage).
  Kontakte gibt es **nur noch dort** (in der Einrichtung steht nur ein Verweis). Die Spracheingabe
  nutzt die Namen. Unter dem Empfängerfeld steht, wer das ist (`updateRecipientHint`), bei einer
  unbekannten Adresse der vorgeschlagene Name mit „Namen festlegen“. Nach dem Versand an eine neue
  Adresse: „Neu im Adressbuch als … – Name ändern“. Schnellauswahl = 4 zuletzt benutzte Namen
  (Feld `used` im Kontakt) + „Alle …“. Funktionen: `openAddressBook`, `upsertContact`, `renderAddressBook`.
- **Spracheingabe** (der Browser wandelt Sprache in Text um): **Start/Stopp** – eine Aufnahme läuft,
  bis der Nutzer „Stopp“ tippt. Chrome beendet die Erkennung nach jeder Sprechpause; die App startet
  sie dann unbemerkt neu und hängt den Text an (`voiceSession`, `runVoiceRound`, `stopVoiceInput`).
  `continuous = false` bewusst, weil `true` auf Android-Chrome Wörter doppelt. Automatisches Ende nach
  1 Minute Stille (`VOICE_IDLE_STOP_MS`) oder bei Mikrofon-/Netzfehlern. Beim Start einer KI-Anfrage
  wird die Aufnahme gestoppt. Auf Android kann bei jedem Neustart ein kurzer Ton kommen.
- **Entwurf mit KI anpassen** (Kasten unter dem Nachrichtentext, sichtbar sobald Text da ist):
  Änderungswunsch eintippen/einsprechen oder Schnellknopf (Kürzer, Freundlicher, Förmlicher,
  Nur Fehler korrigieren). `reviseEmailDraft()` schickt den **aktuellen Entwurf** (in
  `<aktueller_entwurf>`) mit der Anweisung, nur die betroffenen Stellen zu ändern und den Rest
  wörtlich zu übernehmen. Empfänger bleibt fest. „↶ Rückgängig“ (`undoDraftChange`) stellt die
  vorige Fassung her – auch nach einem komplett neuen Entwurf über Schritt 1.
- Als App installierbar (PWA): Chrome → ⋮ → „App installieren“

**Wo ist die App online?** Über GitHub Pages:
https://marchens1977.github.io/KI-Agent/
Jede Änderung an der Hauptversion (main) wird automatisch nach etwa
1 Minute dort veröffentlicht.

### Technischer Aufbau

- **`index.html`** – die gesamte App steckt in dieser einen Datei
  (Aussehen, Texte und Programmlogik). Sprache der Oberfläche: Deutsch,
  dunkles Design, für das Handy optimiert.
- **Tailwind CSS (Aussehen) ist fest eingebaut** (seit 18.11.2026, PR #8): Das fertige CSS
  steht als `<style id="tailwind-css">` am Ende des Kopfbereichs von `index.html` zwischen
  `/* TAILWIND-START */` und `/* TAILWIND-END */`. Es wird **nichts mehr** von
  `cdn.tailwindcss.com` geladen.
  **Wichtig:** Kommen in `index.html` neue Tailwind-Klassen dazu (z. B. `mt-3`, `bg-slate-700`),
  danach im Projektordner `bash werkzeuge/aussehen-bauen.sh` ausführen – sonst fehlen diese
  Klassen. Das Werkzeug erzeugt nur die benutzten Klassen (Tailwind 3.4.19, wie früher das CDN).
  Dazugehörige Dateien: `werkzeuge/tailwind.config.js` (Mets-Farben), `werkzeuge/tailwind-eingabe.css`.
  Die App selbst braucht diese Dateien nicht.
- **Google-Anmeldung** („Google Identity Services“) – damit meldet sich der
  Nutzer bei Gmail an. Dafür braucht die App eine *OAuth-Client-ID* aus der
  Google Cloud (eine Art Ausweisnummer der App bei Google). Sie wird in den
  Einstellungen der App eingetragen.
- **Gmail-Schnittstelle** – Berechtigungen: E-Mails lesen und senden.
- **Gmail meldet sich automatisch an** (`autoConnectGmailOnStartup`): Beim Öffnen der App
  wird der gespeicherte Zugangsschein genutzt bzw. still ein neuer geholt – **ohne** Tippen auf
  „Verbinden“. Der Zugangsschein wird vor Ablauf (ca. 1 Stunde) still erneuert
  (`scheduleTokenRefresh`). Nach geänderten Gmail-Daten in der Einrichtung verbindet sich die
  App ebenfalls automatisch neu. „Verbinden“ ist nur nötig, wenn die stille Anmeldung scheitert.
  **In Anleitungen für den Nutzer daher nicht „auf Verbinden tippen“ schreiben**, sondern:
  „prüfen, dass oben das Gmail-Konto als verbunden angezeigt wird“.
- **KI-Anbieter wählbar** (Einrichtung → „Standard-KI für E-Mails“: Claude / Gemini).
  Das Modell-Auswahlfeld im Reiter „E-Mail“ zeigt **alle** Modelle mit gespeichertem
  Schlüssel in zwei Gruppen (Claude / Gemini). **Was dort ausgewählt ist, wird für E-Mails
  genutzt** und stellt zugleich die Standard-KI um (`onModelChange`, `buildModelDropdown`).
  Zentrale Weiche ist `callAI()`.
  **Dokumente** (PDF, Fotos, eingefügte Texte im Reiter „Dokumente“ und E-Mail-Anhänge
  beim Antworten) gehen **immer an Claude Sonnet 5.5**, sobald ein Claude-Schlüssel
  eingetragen ist. Ohne Claude-Schlüssel kommt vorher eine Warnung (Bestätigungsfenster),
  erst nach „OK“ geht das Dokument an Gemini.
- **Claude-Schnittstelle** – `callClaude()` / `streamClaudeModel()`, direkt vom Browser an
  `api.anthropic.com` (Kopfeintrag `anthropic-dangerous-direct-browser-access`,
  API-Version `2026-10-21`). Modelle: Claude Haiku 5.5 (`claude-haiku-5-5`, Standard für
  E-Mails) und Claude Sonnet 5.5 (`claude-sonnet-5-5`, Ersatz und für Dokumente).
  Schreibt Stück für Stück, feste Antwortfelder per `output_config.format` (JSON-Schema),
  Denk-Aufwand `effort`: E-Mails `low`, Dokumente `medium`. Bei Ablehnung/Überlastung
  wird das andere Claude-Modell versucht. Fotos im Format HEIC nimmt Claude nicht an.
  Claude-Schlüssel liegt wie der Gemini-Schlüssel nur im Browser-Speicher
  (Schutz: Ausgaben-Limit 5 $ und eigener Arbeitsbereich in der Anthropic-Konsole).
- **Schutz für erlaubte Verbindungen (CSP)** – Kopfzeile in `index.html`: Die Seite darf
  Daten nur an sich selbst, Gmail, Gemini, Claude und die Google-Anmeldung schicken
  (`connect-src`). Skripte und Stile nur aus der App selbst und von `accounts.google.com`
  (`script-src`, `style-src`; `'unsafe-inline'` nötig wegen der eingebauten Skripte und
  `onclick`-Knöpfe). Neue Dienste dort eintragen, sonst blockiert der Browser sie.
- **Einrichtungsseite** in Bereichen: „1. KI-Verbindungen“ (je ein Kasten für Claude und
  Gemini mit Schlüssel, Status-Anzeige „✓ gespeichert“, Test-Knopf und Ergebnis direkt
  darunter; Standard-KI; Hinweis zu Dokumenten; Speichern-Knopf mit Rückmeldung) und
  „2. Gmail-Konto“ (Client-ID, Agenten-Adresse, Absendername, eigener Speichern-Knopf).
  Rückmeldungen erscheinen **direkt am Knopf** (`setInlineStatus`); allgemeine Meldungen
  (`showAlert`) erscheinen **unten am Bildschirm** als schwebende Meldung.
- **Gemini-Schnittstelle** – die KI. Dafür braucht die App einen
  *API-Schlüssel* (ein Passwort für die KI). Es gibt eine Modellauswahl
  (z. B. verschiedene „Gemini Flash“-Versionen).
- **`manifest.json`** – App-Name, Farben, Symbole für die Installation.
  Wird als `manifest.json?v=1` eingebunden; bei Änderungen die Nummer erhöhen.
- **`sw.js`** – „Service Worker“ (kleines Hilfsprogramm im Browser), macht die
  App installierbar. Eigene Dateien: erst Internet, sonst gespeicherte Kopie.
  Google-Verbindungen und Tailwind werden **nicht** zwischengespeichert.
  Bei Änderungen die `CACHE`-Version erhöhen.
- **`icons/`** – App-Symbol: weißer Briefumschlag mit orangem KI-Funkeln auf
  Mets-Blau. Vorlagen `icon.svg` und `icon-maskable.svg` (für Android-Rundungen);
  die PNG-Dateien werden daraus erzeugt (z. B. mit Playwright-Screenshot).
- **Farben** – in `werkzeuge/tailwind.config.js` umgedeutet:
  `slate` = Dunkelblau-Töne, `blue` = Mets-Orange, `indigo` = Mets-Blau.
  Grün/Rot/Gelb bleiben für Erfolg/Fehler/Warnung.
- **Zeilenumbrüche in E-Mails** – Die KI soll jeden Absatz als durchgehende Zeile schreiben
  (Anweisung in `buildPersonaSystemInstruction`). Zusätzlich entfernt `unwrapHardLineBreaks()`
  im fertigen Entwurf feste Umbrüche mitten im Satz (vorige Zeile ≥ 45 Zeichen ohne Satzende).
  Leerzeilen, kurze Zeilen (Grußformel, Name, Adresse) und Aufzählungen bleiben.
  Die KI soll außerdem bei jedem Themen-/Gedankenwechsel einen neuen Absatz beginnen
  (kurze Absätze von 2–4 Sätzen).
- **Versand als Text + HTML** (`buildBodyMimeLines`, `emailBodyToHtml`): Jede E-Mail enthält
  eine reine Textfassung und eine formatierte HTML-Fassung (`multipart/alternative`). Grund:
  Reine Text-Mails wurden beim Empfänger nach ca. 70 Zeichen fest umgebrochen – im Hochformat
  entstand unruhiger Flattersatz. In der HTML-Fassung fließt der Text passend zur
  Bildschirmbreite: Absätze (`<p>`) **linksbündig** mit Silbentrennung, einzelne Umbrüche als
  `<br>`, Schrift Arial. Schriftgröße und Zeilenabstand bewusst **nicht** vorgegeben – die bestimmt
  das E-Mail-Programm, damit es wie eine normale E-Mail aussieht (Wunsch des Nutzers; Blocksatz
  und großer Zeilenabstand waren ihm zu unruhig). Bei Anhängen steckt dieser Teil innerhalb von `multipart/mixed`.
- **Versionsanzeige** – `BUILD_TIMESTAMP` in `index.html`, bei Änderungen anpassen.
- **Speicherung** – Einstellungen werden nur im Browser auf dem Gerät
  gespeichert (`localStorage`), nicht auf einem Server.

## 2. Wichtige Regeln und Entscheidungen

- Alles bleibt in **einer Datei** (`index.html`), damit die App einfach
  hochzuladen und zu öffnen ist.
- Oberfläche und Texte auf **Deutsch**.
- Zuerst **für das Smartphone** (Samsung, Chrome) gestalten.
- **Niemals** Zugangsdaten (API-Schlüssel, Client-ID, Passwörter,
  E-Mail-Adressen) in den Code oder in dieses Tagebuch schreiben.
  Diese trägt der Nutzer nur in der App selbst ein.
- Design: **New-York-Mets-Farben** (gilt für alle Apps des Nutzers):
  Orange `#FF5910`, Blau `#002D72`, helles Blau `#6e9bff`, dunkle Hintergründe
  (`#0a1020`). Nur die Farben – **kein Mets-Logo, kein Baseball-Motiv**.
- Vorerst **nur installierbar (PWA)**, keine APK. Grund: Google erlaubt die
  Gmail-Anmeldung nicht in „eingepackten“ Apps (Capacitor-WebView), und die
  Spracheingabe von Chrome fehlt dort. Für eine APK bräuchte es eine eigene
  Android-Anmeldung (zweite Client-ID in der Google Cloud) und Android-Spracherkennung.
- **Automatische Prüfung:** `bash werkzeuge/test/test-starten.sh` (Programm:
  `werkzeuge/test/test-ki.js`). Öffnet die App mit Playwright im Handy-Format, spielt Gemini-
  und Claude-Antworten nach (keine echten Schlüssel, keine echten Anfragen) und prüft 84 Punkte:
  Gemini-/Claude-Entwurf, Dokumente an Claude Sonnet, Warnung ohne Claude-Schlüssel, Einrichtung
  und Rückmeldungen, Modell-Auswahlfeld, Schutz (CSP), kein Tailwind aus dem Internet, Zeilenumbrüche im Entwurf, Versand mit Text- und HTML-Fassung (Gmail-Versand nachgespielt), Adressbuch (auswählen, ändern, neu, löschen, Hinweis beim Empfänger, Hinweis nach Versand), deutscher Datei-Knopf, Spracheingabe bis „Stopp“ (nachgespielt), Entwurf anpassen + Rückgängig.
  **Regel für Claude:** Nach jeder Code-Änderung die Prüfung laufen lassen. Bei neuen Funktionen
  passende Prüfpunkte in `test-ki.js` ergänzen. Hilfsprogramme, die über eine Aufgabe hinaus
  nützlich sind, gehören ins Projekt (Ordner `werkzeuge/`) und ins Tagebuch – nicht nur in den
  Arbeitsbereich der Sitzung, der beim Archivieren verloren geht.
- Lokal (in Claudes Arbeitsumgebung) ist `github.io` gesperrt; `api.anthropic.com` ist
  erreichbar, aber ohne echten Schlüssel. Echte Gmail-Anmeldung kann Claude nicht testen –
  das testet der Nutzer auf dem Handy.
- E-Mails werden vor dem Senden **vom Nutzer geprüft** („Nachricht prüfen und senden“).

## 3. Verlauf

| Datum | Was | PR |
|---|---|---|
| 14.–15.11.2026 | App aufgebaut und in vielen Schritten verbessert (Dateien direkt über GitHub hochgeladen) | – |
| 16.11.2026 | Projekt-Tagebuch `CLAUDE.md` angelegt | #1 |
| 16.11.2026 | Online-Adresse im Tagebuch eingetragen | #2 |
| 18.11.2026 | App installierbar gemacht (Manifest, Service Worker, Symbol) und auf Mets-Farben umgestellt | #3 |
| 18.11.2026 | Analyse der App (Sicherheit, Freigabe, Wiederverwendung) und Überlegung „Claude statt Gemini“ festgehalten | #4 |
| 18.11.2026 | KI-Anbieter wählbar (Gemini/Claude), Dokumente automatisch mit Claude Sonnet, Warnung vor Gemini, Schutz für erlaubte Verbindungen (CSP) | #5 |
| 18.11.2026 | Claude-Verbindung vom Nutzer erfolgreich getestet ✅. Auswahlfeld zeigt Claude- und Gemini-Modelle; Einrichtung übersichtlicher; Rückmeldungen direkt am Knopf bzw. unten am Bildschirm | #6 |
| 18.11.2026 | Vom Nutzer mit echtem Claude-Schlüssel auf dem Handy getestet: E-Mail-Entwurf (Claude Haiku 5.5) und Dokument-Auswertung (Claude Sonnet 5.5) funktionieren ✅ | #7 |
| 18.11.2026 | Aussehen (Tailwind) fest eingebaut statt aus dem Internet geladen; Bau-Werkzeug `werkzeuge/aussehen-bauen.sh`; Schutz (CSP) verbietet fremde Skripte/Stile außer Google-Anmeldung; Zwischenspeicher-Version v4. Vorher/nachher-Bildvergleich: optisch gleich | #8 |
| 18.11.2026 | Automatische Gmail-Anmeldung im Tagebuch dokumentiert; Meldung beim Speichern der Gmail-Daten korrigiert (kein „Verbinden tippen“ mehr), nach geänderten Gmail-Daten automatische Neuverbindung | #9 |
| 18.11.2026 | Vom Nutzer auf dem Handy getestet: eingebautes Aussehen unverändert, automatische Gmail-Anmeldung, Claude-Entwurf und Spracheingabe funktionieren mit dem verschärften Schutz (CSP) ✅ | #10 |
| 18.11.2026 | Automatische Prüfung dauerhaft ins Projekt gelegt (`werkzeuge/test/`, 42 Prüfpunkte) und Regel im Tagebuch: nach jeder Änderung ausführen, bei neuen Funktionen erweitern | #11 |
| 18.11.2026 | Zeilenumbrüche mitten im Satz in E-Mails behoben (KI-Anweisung + Aufräumen des Entwurfs mit `unwrapHardLineBreaks`); 3 neue Prüfpunkte (jetzt 45). Hinweis an den Nutzer: Signatur im KI-Profil ggf. ohne feste Umbrüche speichern | #12 |
| 18.11.2026 | Vom Nutzer auf dem Handy getestet: E-Mail-Entwürfe ohne Zeilenumbrüche mitten im Satz ✅ | #13 |
| 18.11.2026 | E-Mails werden zusätzlich als formatierte HTML-Fassung verschickt (Text fließt im Hochformat als Block, keine festen 70-Zeichen-Umbrüche mehr); KI soll bei Gedankenwechsel neue Absätze bilden; 5 neue Prüfpunkte (jetzt 50) | #14 |
| 19.11.2026 | E-Mail-Darstellung angepasst: linksbündig statt Blocksatz, normaler Zeilenabstand, Schrift Arial | #15 |
| 19.11.2026 | Vom Nutzer auf dem Handy getestet: E-Mails erscheinen im Hoch- und Querformat sauber (linksbündig, normaler Zeilenabstand, keine festen Umbrüche) ✅ | #16 |
| 20.11.2026 | Adressbuch: Namen gespeicherter Kontakte von Hand änderbar (Knopf „Bearbeiten“ in der Einrichtung); 5 neue Prüfpunkte (jetzt 55); Zwischenspeicher v9 | #17 |
| 20.11.2026 | Übersichtlicher: Adressbuch-Fenster im Reiter E-Mail (statt Liste in der Einrichtung), Name-Hinweis unter dem Empfänger, „Neu im Adressbuch“ nach Versand, kurze Namens-Knöpfe, Schritt-Nummern 1–3, deutscher Datei-Knopf bei Dokumenten; 67 Prüfpunkte; Zwischenspeicher v10 | #18 |
| 20.11.2026 | Spracheingabe mit Start/Stopp (bricht nach Pausen nicht mehr ab); Entwurf per Kommando anpassen statt neu schreiben, Schnellknöpfe, Rückgängig; Empfänger-Hinweis bricht um statt abgeschnitten; 84 Prüfpunkte; Zwischenspeicher v11 | #19 |

## 4. Offene Ideen / nächste Schritte

- Später evtl. echte Android-App (APK) wie bei Abo-Übersicht/Fitness-Tracker
  (Capacitor + GitHub Actions); Vorteile: Teilen an die App, Benachrichtigungen, Widget.
  Hürden siehe Abschnitt 2.
- **Später: Claude über den Raspberry Pi** (Idee, noch nicht umgesetzt). Der Claude-Schlüssel
  läge dann nur auf dem Pi; die App fragt den Pi statt Anthropic direkt.
  Hürden: Pi nur im Heimnetz/über WireGuard erreichbar; die App auf GitHub Pages (https) darf
  den Pi nur über https ansprechen → HTTPS auf dem Pi oder App auch vom Pi ausliefern; Pi muss
  eingeschaltet sein. Passt zur Ideen-Sammlung im Projekt „Raspberry-Pi-Server“.
  Eine Datei `PLAN-RASPBERRY.md` gibt es nicht; der Pi-Plan steht im Tagebuch jenes Projekts.
- **Test-Liste für den Nutzer (offen, am Handy abhaken):**
  - [ ] Reiter E-Mail → „Adressbuch“ → beim falschen Namen „Ändern“ → richtigen Namen → „Speichern“
  - [ ] Im Adressbuch einen Kontakt antippen → steht als Empfänger drin, darunter „✓ Name“
  - [ ] Eine unbekannte Adresse eintippen → Hinweis „Neue Adresse – wird gespeichert als …“
  - [ ] Per Spracheingabe eine Mail an den geänderten Namen diktieren → richtige Adresse
  - [ ] Reiter Dokumente → „Datei oder Foto auswählen“ öffnet die Dateiauswahl des Handys
  - [ ] Gefällt dir das neue Aussehen? Sonst kann die Änderung (PR #18) zurückgenommen werden
  - [ ] „Einsprechen“ antippen, mit Pausen sprechen → Aufnahme läuft weiter, bis „Stopp“ getippt wird
  - [ ] Entwurf erstellen → im Kasten „Entwurf mit KI anpassen“ z. B. „Mach den Schluss herzlicher“
        einsprechen → „Entwurf anpassen“ → nur der Schluss ändert sich, Rest bleibt gleich
  - [ ] Danach „↶ Rückgängig“ → vorige Fassung ist wieder da
  - [ ] Schnellknopf „Kürzer“ ausprobieren
- Weitere Wünsche des Nutzers hier sammeln.

**Stand am Ende der Sitzung vom 18./19.11.2026:** Alles umgesetzte ist vom Nutzer getestet und
funktioniert. Keine offenen Fehler. Für die nächste Arbeit eine neue Sitzung öffnen; dieses
Tagebuch ist die Grundlage.

## 5. Zusammenarbeit mit dem Nutzer

- Der Nutzer ist **Programmier-Laie**. Er nutzt KI für „Vibe-Coding“.
- **Einfaches Deutsch**, Fachbegriffe kurz erklären.
- **Kleine, nummerierte Schritte**.
- Immer klar sagen: **was Claude übernimmt** und **was der Nutzer selbst tun muss**.
- Claude übernimmt alles, was möglich ist – auch Pull Request anlegen
  (Änderungsvorschlag auf GitHub) und mergen (in die Hauptversion übernehmen).
- Hardware des Nutzers: nur **Samsung-Smartphone (Chrome)** und **Raspberry Pi 400**.

## 6. Hinweis zum KI-Modell

Wenn du nicht auf Opus läufst (z. B. Fable) und eine Aufgabe abgeschlossen
ist, erinnere den Nutzer am Ende der Antwort:
„Tipp: Du kannst jetzt mit /model claude-opus-5-5 zurückstellen.“

## 7. Pflege dieses Tagebuchs

Nach jeder größeren Änderung dieses Tagebuch aktualisieren
(vor allem Verlauf und offene Ideen).
