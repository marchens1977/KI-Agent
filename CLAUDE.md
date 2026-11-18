# Projekt-Tagebuch: KI-Agent

Dieses Tagebuch hilft Claude (und dem Nutzer), in jeder neuen Sitzung schnell
zu wissen, worum es geht, was schon erledigt ist und wie wir zusammenarbeiten.

## 1. Worum es in der App geht

Der **KI-Agent** ist ein persönlicher E-Mail-Assistent als Webseite.
Er nutzt die KI **Google Gemini** und ist mit **Gmail** verbunden.

Was die App kann:
- E-Mails mit KI-Hilfe schreiben, prüfen und senden
- Den Nachrichtenverlauf des Assistenten-Kontos anzeigen (Posteingang und Gesendet)
- Dokumente hochladen oder Text einfügen und von der KI auswerten lassen
- Eine Rolle, einen Schreibstil und Grundinformationen für die KI festlegen
- E-Mail-Signatur und Grußformel einstellen
- Zugangsdaten verwalten, getrennt nach Konten (Kontotrennung)
- Kontakte speichern, damit die Spracheingabe Namen besser erkennt
- Spracheingabe (der Browser wandelt Sprache in Text um)
- Als App installierbar (PWA): Chrome → ⋮ → „App installieren“

**Wo ist die App online?** Über GitHub Pages:
https://marchens1977.github.io/KI-Agent/
Jede Änderung an der Hauptversion (main) wird automatisch nach etwa
1 Minute dort veröffentlicht.

### Technischer Aufbau

- **`index.html`** – die gesamte App steckt in dieser einen Datei
  (Aussehen, Texte und Programmlogik). Sprache der Oberfläche: Deutsch,
  dunkles Design, für das Handy optimiert.
- **Tailwind** (wird aus dem Internet geladen) – sorgt für das Aussehen.
- **Google-Anmeldung** („Google Identity Services“) – damit meldet sich der
  Nutzer bei Gmail an. Dafür braucht die App eine *OAuth-Client-ID* aus der
  Google Cloud (eine Art Ausweisnummer der App bei Google). Sie wird in den
  Einstellungen der App eingetragen.
- **Gmail-Schnittstelle** – Berechtigungen: E-Mails lesen und senden.
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
- **Farben** – oben in `index.html` (`tailwind.config`) umgedeutet:
  `slate` = Dunkelblau-Töne, `blue` = Mets-Orange, `indigo` = Mets-Blau.
  Grün/Rot/Gelb bleiben für Erfolg/Fehler/Warnung.
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
- Lokal (in Claudes Arbeitsumgebung) sind `cdn.tailwindcss.com` und `github.io`
  gesperrt → zum Testen Tailwind mit `npx tailwindcss@3` selbst bauen und in
  Playwright für die CDN-Adresse einsetzen.
- E-Mails werden vor dem Senden **vom Nutzer geprüft** („Nachricht prüfen und senden“).

## 3. Verlauf

| Datum | Was | PR |
|---|---|---|
| 14.–15.11.2026 | App aufgebaut und in vielen Schritten verbessert (Dateien direkt über GitHub hochgeladen) | – |
| 16.11.2026 | Projekt-Tagebuch `CLAUDE.md` angelegt | #1 |
| 16.11.2026 | Online-Adresse im Tagebuch eingetragen | #2 |
| 18.11.2026 | App installierbar gemacht (Manifest, Service Worker, Symbol) und auf Mets-Farben umgestellt | #3 |
| 18.11.2026 | Analyse der App (Sicherheit, Freigabe, Wiederverwendung) und Überlegung „Claude statt Gemini“ festgehalten | #4 |

## 4. Offene Ideen / nächste Schritte

- Später evtl. echte Android-App (APK) wie bei Abo-Übersicht/Fitness-Tracker
  (Capacitor + GitHub Actions); Vorteile: Teilen an die App, Benachrichtigungen, Widget.
  Hürden siehe Abschnitt 2.
- **Überlegung (noch nicht umgesetzt, wartet auf OK des Nutzers): Claude statt/neben Gemini**
  - Ziel: für sensible Themen (Versicherungen, Finanzen) wahlweise Claude von Anthropic nutzen,
    z. B. Claude Haiku 5.5 (`claude-haiku-5-5`) für einfache und Claude Sonnet 5.5
    (`claude-sonnet-5-5`) für schwierige Aufgaben.
  - Umsetzung: Anbieter-Auswahl „Gemini / Claude“ in der Einrichtung. Betroffen sind nur die
    KI-Teile (`streamSingleModel`, `callGemini`, Modellliste, Verbindungstest, Dateitypen);
    Gmail, Spracheingabe, Freigabe usw. bleiben gleich. Aufwand: mittel.
  - Funktionen: Stück-für-Stück-Schreiben, PDFs, Fotos und Ersatz-Modelle gehen auch mit Claude.
    Fotos im Format HEIC nimmt Claude nicht an (JPEG/PNG/WebP/GIF schon).
  - Weg: Claude ist direkt vom Handy-Browser erreichbar (mit einem besonderen Kopfeintrag für
    Browser-Zugriff); der Schlüssel läge dann wie heute der Gemini-Schlüssel im Browser-Speicher.
    Schutz: eigener Arbeitsbereich und Ausgaben-Limit in der Anthropic-Konsole, Ablaufdatum für den Schlüssel.
  - Später sicherer: Zwischenstation auf dem Raspberry Pi (Schlüssel bleibt auf dem Pi).
    Hürden: Pi nur im Heimnetz/über WireGuard erreichbar, und die App auf GitHub Pages (https)
    darf den Pi nur über https ansprechen → HTTPS auf dem Pi oder App auch vom Pi ausliefern.
    Passt zur Ideen-Sammlung im Projekt „Raspberry-Pi-Server“ (Pi verwahrt Claude-Schlüssel).
    Eine Datei `PLAN-RASPBERRY.md` gibt es nicht; der Pi-Plan steht im Tagebuch jenes Projekts.
- Weitere Wünsche des Nutzers hier sammeln.

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
