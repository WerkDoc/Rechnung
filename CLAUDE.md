# WerkDoc – Projektnotizen für Claude

## Kommunikation
- **Immer auf Deutsch antworten** (im Chat), per „du“.
- Vor größeren Umbauten erst den Plan erklären, dann umsetzen.

## Feste Regeln
- **Immer vom aktuellen Stand aus arbeiten.** Vor Änderungen `git fetch` + `git status` / `git log` prüfen. Nie mit einer alten lokalen Kopie arbeiten – das hat **zweimal** die ganze Rechnungs-Anbindung überschrieben (Commit „New Layout“, 06.11.2026, und die Web-Uploads „Add files via upload“ vom 10.11.2026). Beide Male per 3-Wege-Merge zurückgeholt (Basis b2c1e21).
  → Wenn auf GitHub neue „Add files via upload“-Commits liegen: prüfen, ob die Teile unten noch drin sind, bevor weitergearbeitet wird.
  → Ein drittes Mal am 13.11.2026 (Uploads v69 aus dem Claude-Chat, a927061/9fb6222/0d25617) – per 3-Wege-Merge in PR #1 zurückgeholt.
- **Zweiter Claude (Chat/Artifact) arbeitet seit 13.11.2026 direkt im Repo:** holt vorher den aktuellen Stand, arbeitet auf einem eigenen Branch und öffnet einen **Pull Request** – kein Datei-Upload mehr, kein direkter Push auf `main`. Offene PRs vor eigenen Änderungen an denselben Dateien prüfen (`gh api repos/WerkDoc/rechnung/pulls`).
- **Git:** Vor jedem größeren Schritt lokal committen. **Nur pushen, wenn der Nutzer es ausdrücklich sagt** (sonst pusht er selbst über GitHub Desktop). Seit 12.11.2026 kann Claude per GitHub CLI pushen (Konto `WerkDoc`, Anmeldehilfe in `~/.gitconfig` nur für github.com). (WerkDoc läuft nicht auf Netlify, daher kein Branch „entwicklung“ – das gilt nur für die Website.)
- Git liegt nur in GitHub Desktop:
  `(Get-ChildItem "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" | Select-Object -Last 1).FullName`
- `rechnung-vorlage.pdf` enthält echte Kundendaten → steht in `.gitignore`, nie committen.
- `wb_website_zugang_erzeugen` **nicht ohne Grund ausführen** – erzeugt einen neuen Website-Key und macht den alten (Secret `WERKDOC_WEBSITE_KEY` im Website-Supabase) ungültig.
- Kleinunternehmer nach §19 UStG. Rechnungstexte in **du-Form**.

## Was bei Design-Änderungen erhalten bleiben MUSS
Diese Teile in `src/legacy/app.js` dürfen bei Layout-/Design-Umbauten nicht verloren gehen:
- **Nummernvergabe** über den gemeinsamen Cloud-Zähler: `reserveNr()` → RPC `wb_naechste_nr` (Fallback lokal nur bei PGRST202 bzw. offline als Entwurf). Format `RE-030/2026`, `AN-…`, `KV-…`; Einstellung „Rechnungen {Jahr} starten bei“ (`reStart`/`reStartYear`).
- **Löschsperre:** `docLocked(r)` – Rechnungen mit Nummer sind nicht löschbar (auch nicht per Mehrfachauswahl). Korrektur nur per Storno + neue Rechnung.
- **Gemeinsames Rechnungs-Modul** `src/legacy/rechnungPdf.js` (siehe unten): `import { zeichneRechnung, belegDaten, belegSummen, empfaengerZeilen, … }`; `calc()` nutzt `belegSummen`; `neutralDaten(r)` / `belegFuerPdf(r)`; `PDF_SCHRIFT` + `SCHRIFT_P` (Open Sans aus `src/assets/openSans.js`).
- **Layout „Neutral“ = nur das Modul:** `layOf(r)` – Website-Rechnungen (`websiteAuftrag`/`quelle:"website"`) immer „Neutral“. `buildPdfDoc` zeichnet dann ausschließlich mit `zeichneRechnung` (kein Stempel, keine Zusätze).
- **Vorschau = echtes PDF:** `paperBox(r)` → `pdfBox(r)` → `zeichnePdfVorschau()` rendert das jsPDF-Ergebnis mit **pdf.js** (`pdfjs-dist@3.11.174`, `isEvalSupported:false`) als Canvas. Kein HTML-Nachbau des Layouts „Neutral“ mehr. CSS `.pdfprev`.
- **Anschrift fest im Beleg:** Beim Erstellen (`finish(make)`) werden `empfaenger` (Zeilen) und `kundenNr` in die Rechnung geschrieben. Anzeige/PDF lesen **nie** neu aus dem Kundenstamm (`docParts`, `belegFuerPdf`) – nur Entwürfe und alte Belege ohne `empfaenger` fallen darauf zurück.
- **GiroCode:** `qrMatrix()` mit `qrcode-generator`; ob er erscheint, entscheidet `belegDaten` (nur offene Rechnungen mit Nummer). Firmenfeld **Kontoinhaber** (`cKInh`).
- **Garantie-Muster:** Ersatzteil-Positionen bekommen „inkl. Ersatzteil, Einbau & Funktionstest · [Garantie]*“ + IMEI; Garantie aus Teil (`tGar`) → Firma (`cGar`) → `GARANTIE_STANDARD`; Fußnote unter der Tabelle.
- CSS in `src/styles.css`: `@font-face "Open Sans RM"`, `.pdfprev`, `.pcard textarea.pd`.

## Gemeinsames Rechnungs-Modul (EINE Datei für WerkDoc und Website)
- `src/legacy/rechnungPdf.js` gibt es **nur hier**. Die Website-Edge-Function `rechnung-senden` importiert genau diese Datei von GitHub, festgenagelt auf einen Commit:
  `https://raw.githubusercontent.com/WerkDoc/Rechnung/<commit>/src/legacy/rechnungPdf.js`
- **Nach jeder Änderung am Modul:** WerkDoc committen → Nutzer pusht → Commit-Hash in `RepairMobile-Website/supabase/functions/rechnung-senden/index.ts` eintragen → Function neu deployen.
- Ablauf auf beiden Seiten: `zeichneRechnung(doc, belegDaten(r, { firma, logo, schrift, qr }))`, r = der gespeicherte Datensatz.
- `belegDaten` entscheidet alle Texte: du-Form („Deine Kundennummer“, „Dein Ansprechpartner“, „Danke für deinen Auftrag …“), Zahlungshinweis `zahlungsText()` – **entweder** „Betrag dankend erhalten am …“ (bezahlt) **oder** „Bitte bezahle … bis …“ + GiroCode (offen), storniert: „Diese Rechnung wurde storniert.“ Alte Notizen „Bitte bezahle …“ werden ausgeblendet.

## Verbindung zur Website
- Website-Repo: `C:\Users\ElexS\Documents\RepairMobile-Website\RepairMobile-Website` (eigene CLAUDE.md, arbeitet auf Branch `entwicklung`).
- WerkDoc-Supabase: Projekt `zalniuqiberpnzgbbufk` (anderes Konto als die Website). Daten in `wb_records(user_id, coll, id, data jsonb, deleted, …)`, coll ∈ kunden, auftraege, rechnungen, teile, ausgaben, firma.
- `supabase/werkdoc-rechnungen.sql`: Zähler `wb_nummern` / `wb_nr_ziehen` / `wb_naechste_nr`, Schutz-Trigger `wb_rechnung_schutz` (schützt auch `empfaenger`, `kundenNr`), Website-Funktionen `wb_website_rechnung`, `wb_website_versendet`, `wb_website_status`, `wb_website_bezahlt` (Zugriff nur mit Website-Key).
- `wb_website_rechnung`: Website hat Vorrang – Name/Anschrift aus dem Auftrag werden in der Rechnung festgeschrieben **und** im Kundenstamm aktualisiert (Kunde per E-Mail gefunden; fehlt eine feste Kundennummer, wird die angezeigte festgeschrieben). Gibt den gespeicherten Beleg als `rechnung` zurück – daraus zeichnet die Website ihr PDF.

## Lokal testen
- `npx vite --port 5180` im Ordner `Rechnung`.
- Testmodus ohne Anmeldung: temporäre Kopie von `index.html` mit `<script>window.claude={use:()=>Promise.reject()}</script>` im `<head>` anlegen → Button „Ohne Anmeldung testen“. Datei danach wieder löschen.
- Build-Check: `npx vite build --outDir <Scratchpad>` (nicht ins Repo bauen).
- SQL lokal prüfen: PGlite im Scratchpad (pgcrypto per `sha256()`-Ersatz; `raise … using errcode` bringt PGlite zum Absturz).

## Aktueller Stand (12.11.2026)
- Uploads vom 10.11. + Rechnungs-Anbindung zusammengeführt; gemeinsames Rechnungs-Modul, feste Anschrift, PDF-Vorschau mit pdf.js. Website- und WerkDoc-PDF von RE-035 lokal pixelgleich geprüft.
- Offen beim Nutzer: WerkDoc pushen; `supabase/werkdoc-rechnungen.sql` im WerkDoc-Supabase ausführen; danach Website-Function deployen. „Jahreszahl in Belegnummer“ an, Start 30, Kontoinhaber eintragen; Testrechnungen stornieren (nicht löschen).
