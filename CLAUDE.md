# WerkDoc – Projektnotizen für Claude

## Kommunikation
- **Immer auf Deutsch antworten** (im Chat), per „du“.
- Vor größeren Umbauten erst den Plan erklären, dann umsetzen.

## Feste Regeln
- **Immer vom aktuellen Stand aus arbeiten.** Vor Änderungen `git status` / `git log` prüfen. Nie mit einer alten lokalen Kopie arbeiten – das hat schon einmal (Commit „New Layout“, 06.11.2026) die ganze Rechnungs-Anbindung überschrieben.
- **Git:** Vor jedem größeren Schritt lokal committen. **Niemals pushen** – das macht der Nutzer selbst über GitHub Desktop.
- Git liegt nur in GitHub Desktop:
  `(Get-ChildItem "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" | Select-Object -Last 1).FullName`
- `rechnung-vorlage.pdf` enthält echte Kundendaten → steht in `.gitignore`, nie committen.
- `wb_website_zugang_erzeugen` **nicht ohne Grund ausführen** – erzeugt einen neuen Website-Key und macht den alten (Secret `WERKDOC_WEBSITE_KEY` im Website-Supabase) ungültig.
- Kleinunternehmer nach §19 UStG.

## Was bei Design-Änderungen erhalten bleiben MUSS
Diese Teile in `src/legacy/app.js` dürfen bei Layout-/Design-Umbauten nicht verloren gehen:
- **Nummernvergabe** über den gemeinsamen Cloud-Zähler: `reserveNr()` → RPC `wb_naechste_nr` (Fallback lokal nur bei PGRST202 bzw. offline als Entwurf). Format `RE-030/2026`, `AN-…`, `KV-…`; Einstellung „Rechnungen {Jahr} starten bei“ (`reStart`/`reStartYear`).
- **Löschsperre:** `docLocked(r)` – Rechnungen mit Nummer sind nicht löschbar (auch nicht per Mehrfachauswahl). Korrektur nur per Storno + neue Rechnung.
- **Gemeinsames PDF-Layout „Neutral“:** `import … from "./rechnungPdf.js"` (`zeichneRechnung`, `positionsTitel`, `positionsText`, `garantieHinweis`, `giroCodeText`, `fussSpalten`), `neutralDaten()`, `PDF_SCHRIFT` (Open Sans aus `src/assets/openSans.js`).
- **GiroCode:** `qrMatrix()` mit `qrcode-generator`, nur auf offenen Rechnungen mit Nummer; Firmenfeld **Kontoinhaber** (`cKInh`).
- **Garantie-Muster:** Ersatzteil-Positionen bekommen „inkl. Ersatzteil, Einbau & Funktionstest · [Garantie]*“ + IMEI; Garantie aus Teil (`tGar`) → Firma (`cGar`) → `GARANTIE_STANDARD`; Fußnote unter der Tabelle.
- `belegNotiz(r)`: Zahlungsaufforderung der Website („Bitte bezahle …“) entfällt bei bezahlten Rechnungen.
- CSS in `src/styles.css`: `@font-face "Open Sans RM"`, `.lay-neutral`/`.nt-*`, `.nt-giro`, `.pcard textarea.pd`.

## Verbindung zur Website
- Website-Repo: `C:\Users\ElexS\Documents\RepairMobile-Website\RepairMobile-Website` (eigene CLAUDE.md).
- `src/legacy/rechnungPdf.js` ist der **Master**; eine **1:1-Kopie** liegt in der Website unter `supabase/functions/rechnung-senden/rechnungPdf.js`. Bei Änderungen beide gleich halten.
- WerkDoc-Supabase: Projekt `zalniuqiberpnzgbbufk` (anderes Konto als die Website). Daten in `wb_records(user_id, coll, id, data jsonb, deleted, …)`, coll ∈ kunden, auftraege, rechnungen, teile, ausgaben, firma.
- `supabase/werkdoc-rechnungen.sql`: Zähler `wb_nummern` / `wb_nr_ziehen` / `wb_naechste_nr`, Schutz-Trigger `wb_rechnung_schutz`, Website-Funktionen `wb_website_rechnung`, `wb_website_versendet`, `wb_website_status`, `wb_website_bezahlt` (Zugriff nur mit Website-Key).

## Lokal testen
- `npx vite --port 5180` im Ordner `Rechnung`.
- Testmodus ohne Anmeldung: temporäre Kopie von `index.html` mit `<script>window.claude={use:()=>Promise.reject()}</script>` im `<head>` anlegen → Button „Ohne Anmeldung testen“. Datei danach wieder löschen.
- Build-Check: `npx vite build --outDir <Scratchpad>` (nicht ins Repo bauen).

## Aktueller Stand (07.11.2026)
- Neues Design („New Layout“) + Rechnungs-Anbindung zusammengeführt (Commit 4f8c065), noch nicht gepusht.
- Offen beim Nutzer: pushen; „Jahreszahl in Belegnummer“ an, Start 30, Kontoinhaber eintragen; Testrechnungen stornieren (nicht löschen).
