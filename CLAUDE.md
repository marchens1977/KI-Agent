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
- E-Mails werden vor dem Senden **vom Nutzer geprüft** („Nachricht prüfen und senden“).

## 3. Verlauf

| Datum | Was | PR |
|---|---|---|
| 14.–15.11.2026 | App aufgebaut und in vielen Schritten verbessert (Dateien direkt über GitHub hochgeladen) | – |
| 16.11.2026 | Projekt-Tagebuch `CLAUDE.md` angelegt | #1 |
| 16.11.2026 | Online-Adresse im Tagebuch eingetragen | #2 |

## 4. Offene Ideen / nächste Schritte

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
