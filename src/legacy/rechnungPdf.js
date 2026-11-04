/*
 * RepairMobile – Rechnungslayout „Neutral“ (nach rechnung-vorlage.pdf)
 * Zeichnet einen Beleg mit jsPDF. Wird von WerkDoc UND von der Website (Supabase Edge Function
 * rechnung-senden) benutzt – damit Rechnungen aus dem Laden und von der Website gleich aussehen.
 *
 * !!! Diese Datei gibt es zweimal: Rechnung/src/legacy/rechnungPdf.js und
 *     RepairMobile-Website/supabase/functions/rechnung-senden/rechnungPdf.js
 *     Bei Änderungen beide Dateien gleich halten (einfach kopieren). !!!
 *
 * Keine Abhängigkeiten – bekommt nur ein fertiges Datenobjekt B:
 * {
 *   logo:        "data:image/png;base64,…" (optional)
 *   firma:       { name, strasse, plz, ort, land, tel, mail, stnr, ustid, inhaber, bank, iban, bic }
 *   empfaenger:  ["Herrn Max Muster", "Straße 1", "12345 Ort", "Deutschland"]
 *   titel:       "Rechnung"           nrLabel: "Rechnungs-Nr."        nr: "RE-030/2026"
 *   meta1:       [["Rechnungsdatum","03.11.2026"], ["Lieferdatum","03.11.2026"]]
 *   meta2:       [["Auftrag","RM-00005"], ["Ihre Kundennummer","1034"], ["Ihr Ansprechpartner","Oleg Schäfer"]]
 *   unterzeile:  ["Rechnungsdatum entspricht Leistungsdatum", "Gerät: iPhone 11"]
 *   positionen:  [{ bez, text, menge, einheit, preis }]   (text = Zeile(n) unter dem fetten Titel, mehrere mit \n)
 *                Enthält eine Position ein *, steht unter der Tabelle automatisch GARANTIE_HINWEIS.
 *   summen:      { netto, brutto, mwst, mwstSatz, rabatt, rabattSatz, summe, ku }   (ku = Kleinunternehmer)
 *   texte:       ["Bitte überweise …", "Wir bedanken uns …"]
 *   gruss:       "RepairMobile"
 *   schrift:     { name:"OpenSans", normal:"<base64 TTF>", bold:"<base64 TTF>" }   (optional, sonst Helvetica)
 *   girocode:    { name, iban, bic, betrag, zweck }   (optional: QR-Code zum Überweisen + Bankdaten als Text)
 *   qr:          text => ({ n, dark(r, c) })          (QR-Matrix, z. B. mit qrcode-generator erzeugt)
 * }
 */

// Muster für Reparatur-Positionen (Website und WerkDoc gleich):
//   Titel:     [Reparatur] [Gerät] – [Ausführung] (Festpreis)        Ausführung nur, wenn gewählt
//   Zeile 2:   inkl. Ersatzteil, Einbau & Funktionstest · [Garantie]*
//   Zeile 3:   Serien-/IMEI-Nr.: …                                    nur, wenn vorhanden
export const GARANTIE_STANDARD = "12 Monate Garantie auf das Ersatzteil";
export const GARANTIE_HINWEIS = "* Es gelten unsere Garantiebedingungen: repair-mobile.de/garantie. Ihre gesetzlichen Gewährleistungsrechte bleiben unberührt.";
export function positionsTitel(reparatur, geraet, ausfuehrung) {
  return [reparatur, geraet].map(s => String(s || "").trim()).filter(Boolean).join(" ") + (ausfuehrung ? " – " + String(ausfuehrung).trim() : "") + " (Festpreis)";
}
export function positionsText(garantie, imei) {
  return [`inkl. Ersatzteil, Einbau & Funktionstest · ${String(garantie || GARANTIE_STANDARD).trim()}*`, imei ? `Serien-/IMEI-Nr.: ${String(imei).trim()}` : ""].filter(Boolean).join("\n");
}
// Hinweis unter der Tabelle, sobald eine Position mit * auf die Garantie verweist
export const garantieHinweis = (positionen = []) => positionen.some(p => /\*/.test(String(p.bez || "") + String(p.text || ""))) ? GARANTIE_HINWEIS : "";

// GiroCode (EPC-QR für SEPA-Überweisungen): Banking-Apps füllen damit Empfänger, IBAN, Betrag und Verwendungszweck aus
export function giroCodeText(g = {}) {
  const betrag = (Math.round((+g.betrag || 0) * 100) / 100).toFixed(2);
  return ["BCD", "002", "1", "SCT", String(g.bic || "").replace(/\s+/g, "").toUpperCase(), String(g.name || "").trim().slice(0, 70),
    String(g.iban || "").replace(/\s+/g, "").toUpperCase(), "EUR" + betrag, "", "", String(g.zweck || "").trim().slice(0, 140)].join("\n");
}

// Fußzeile in vier Spalten: Anschrift | Kontakt | Steuer & Inhaber | Bank (Konto und BLZ aus einer deutschen IBAN)
export function fussSpalten(f = {}) {
  const iban = String(f.iban || "").replace(/\s+/g, "").toUpperCase();
  const blz = /^DE\d{20}$/.test(iban) ? iban.slice(4, 12) : "", konto = blz ? iban.slice(12).replace(/^0+/, "") : "";
  const inh = f.inhaber || f.ansprechpartner;
  return [
    [f.name, f.strasse, [f.plz, f.ort].filter(Boolean).join(" "), f.land || "Deutschland"],
    [f.tel && "Tel. " + f.tel, f.mail && "E-Mail " + f.mail],
    [f.stnr && "Steuer-Nr. " + f.stnr, f.ustid && "USt-IdNr. " + f.ustid, inh && "Inhaber/-in " + inh],
    [f.bank && "Bank " + f.bank, konto && "Konto " + konto, blz && "BLZ " + blz, iban && "IBAN " + iban, f.bic && "BIC " + f.bic],
  ].map(c => c.filter(Boolean));
}

export function zeichneRechnung(doc, B) {
  const L = 21, R = 194, VR = 195.5, FOOT = 275.6, BOTTOM = 258;
  const INK = [26, 26, 26], SUB = [68, 68, 68], FILL = [235, 235, 235], LINE = [222, 222, 222], BLUE = [74, 156, 201];
  const f = B.firma || {}, s = B.summen || {};
  let FN = "helvetica";
  if (B.schrift && B.schrift.normal) {
    try {
      const n = B.schrift.name || "OpenSans";
      doc.addFileToVFS(n + "-Regular.ttf", B.schrift.normal); doc.addFont(n + "-Regular.ttf", n, "normal");
      doc.addFileToVFS(n + "-Bold.ttf", B.schrift.bold || B.schrift.normal); doc.addFont(n + "-Bold.ttf", n, "bold");
      FN = n;
    } catch (e) { FN = "helvetica"; }
  }
  const fnt = (st, sz) => { doc.setFont(FN, st); doc.setFontSize(sz); };
  const col = c => doc.setTextColor(c[0], c[1], c[2]);
  const txt = (t, x, y, o) => doc.text(Array.isArray(t) ? t : String(t == null ? "" : t), x, y, o);
  const zahl = (n, d = 2) => (Math.round((+n || 0) * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
  const eur = n => zahl(n) + " EUR";
  const einheit = e => String(e || "Stk.").replace(/^(Stk|Std)\.$/, "$1");

  // ---- Kopf: Logo mittig
  if (B.logo) {
    try { const p = doc.getImageProperties(B.logo), ra = p.width / p.height; let w = 84, h = w / ra; if (h > 23) { h = 23; w = h * ra; }
      doc.addImage(B.logo, B.logo.startsWith("data:image/png") ? "PNG" : "JPEG", (210 - w) / 2, 8, w, h); }
    catch (e) { fnt("bold", 18); col(INK); txt(f.name || "", 105, 22, { align: "center" }); }
  } else { fnt("bold", 18); col(INK); txt(f.name || "", 105, 22, { align: "center" }); }

  // ---- Absenderzeile + Empfänger
  fnt("normal", 6.3); col(INK); txt([f.name, f.strasse, [f.plz, f.ort].filter(Boolean).join(" ")].filter(Boolean).join("  -  "), L, 50.2);
  fnt("normal", 9.5); (B.empfaenger || []).forEach((z, i) => txt(z, L, 63 + i * 3.95));

  // ---- Rechnungsdaten rechts
  const MX = 130;
  fnt("normal", 11.5); col(INK); txt(B.nrLabel || "Rechnungs-Nr.", MX, 56.8); txt(B.nr || "", VR, 56.8, { align: "right" });
  let my = 61.4;
  const metaZeile = ([a, b]) => { fnt("normal", 7); col(INK); txt(a, MX, my); txt(String(b), VR, my, { align: "right" }); my += 3.9; };
  (B.meta1 || []).filter(m => m && m[1]).forEach(metaZeile);
  const m2 = (B.meta2 || []).filter(m => m && m[1]);
  if (m2.length) { my += 2.8; m2.forEach(metaZeile); }

  // ---- Titel + Unterzeilen
  let y = Math.max(97, my + 14);
  fnt("bold", 12.5); col(INK); txt(`${B.titel || "Rechnung"} Nr. ${B.nr || ""}`, L + 1.4, y);
  y += 12.4; fnt("normal", 9.3); col(SUB);
  (B.unterzeile || []).filter(Boolean).forEach(z => { txt(doc.splitTextToSize(z, R - L), L + 1.4, y); y += 4.6; });
  y += 1.4;

  // ---- Positionstabelle
  const cPos = L + 2.5, cDesc = L + 12.7, cM = 137, cE = 164.5, cG = R - 1, dw = cM - 22 - cDesc;
  const kopf = () => { doc.setFillColor(FILL[0], FILL[1], FILL[2]); doc.rect(L + 1.4, y, R - L - 1.4, 6.2, "F"); fnt("bold", 9.3); col(INK);
    txt("Pos.", cPos, y + 4.3); txt("Beschreibung", cDesc, y + 4.3); txt("Menge", cM, y + 4.3, { align: "right" }); txt("Einzelpreis", cE, y + 4.3, { align: "right" }); txt("Gesamtpreis", cG, y + 4.3, { align: "right" }); y += 6.2; };
  const neueSeite = () => { doc.addPage(); y = 20; };
  kopf(); y += 3.1;
  (B.positionen || []).forEach((p, i) => {
    fnt("bold", 9.3); const t1 = doc.splitTextToSize(String(p.bez || ""), dw);
    fnt("normal", 9.3); const t2 = p.text ? String(p.text).split(/\r?\n/).flatMap(z => doc.splitTextToSize(z, dw)) : [];
    // Zeilenabstand: 4,4 mm innerhalb von Titel/Beschreibung, 5,5 mm vom Titel zur Beschreibung (wie Vorlage)
    const ZL = 4.4, ZT = 5.5, yT = (t1.length - 1) * ZL + (t2.length ? ZT : 0);
    const h = yT + Math.max(0, t2.length - 1) * ZL + 7.9;
    if (y + h > BOTTOM) { neueSeite(); kopf(); y += 3.1; }
    const yl = y + 3.2; col(INK);
    fnt("normal", 9.3); txt(`${i + 1}.`, cPos, yl);
    txt(`${zahl(p.menge)} ${einheit(p.einheit)}`, cM, yl, { align: "right" }); txt(eur(p.preis), cE, yl, { align: "right" }); txt(eur((+p.menge || 0) * (+p.preis || 0)), cG, yl, { align: "right" });
    fnt("bold", 9.3); t1.forEach((z, j) => txt(z, cDesc, yl + j * ZL));
    fnt("normal", 9.3); t2.forEach((z, j) => txt(z, cDesc, yl + yT + j * ZL));
    y += h;
  });
  if (y + 28 > BOTTOM) neueSeite();
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.25); doc.line(L + 1.4, y, R, y); y += 0.8;

  // ---- Summen
  const sZeile = (a, b, grau, fett) => {
    if (grau) { doc.setFillColor(FILL[0], FILL[1], FILL[2]); doc.rect(L + 1.4, y, R - L - 1.4, 5.9, "F"); }
    fnt(fett ? "bold" : "normal", 9.3); col(INK); txt(a, cDesc, y + 4.1); if (b) txt(b, cG, y + 4.1, { align: "right" }); y += 6.5; };
  if (s.rabatt) { sZeile("Summe Positionen", eur(s.summe), false); sZeile(`Rabatt (${zahl(s.rabattSatz, 0)} %)`, "− " + eur(s.rabatt), false); }
  sZeile("Gesamtbetrag netto", eur(s.netto), true);
  if (s.mwst) sZeile(`zzgl. Umsatzsteuer ${zahl(s.mwstSatz, 0)} %`, eur(s.mwst), false);
  else sZeile(s.ku ? "Umsatzsteuer nicht erhoben gemäß §19UStG." : "Umsatzsteuer 0 %", "", false);
  sZeile("Gesamtbetrag brutto", eur(s.brutto), true, true);

  // ---- Texte + Gruß
  y += 7.7; fnt("normal", 9.3); col(INK);
  const absatz = t => { fnt("normal", 9.3); col(INK); const ls = String(t).split(/\r?\n/).flatMap(z => doc.splitTextToSize(z, R - L - 1.4)); if (y + ls.length * 4.2 > BOTTOM) neueSeite(); ls.forEach((z, j) => txt(z, L + 1.4, y + j * 4.2)); y += ls.length * 4.2 + 2.6; };
  const hinweis = garantieHinweis(B.positionen); if (hinweis) absatz(hinweis);

  // ---- GiroCode + Bankdaten (nur bei offenen Rechnungen; B.qr = Funktion, die aus Text eine QR-Matrix macht)
  const gc = B.girocode;
  if (gc && gc.iban && +gc.betrag > 0 && typeof B.qr === "function") {
    let m = null; try { m = B.qr(giroCodeText(gc)); } catch (e) { m = null; }
    if (m && m.n) {
      const S = 26, X = L + 1.4, Y0 = y - 2.5;
      if (Y0 + S + 8 > BOTTOM) neueSeite();
      const yq = Math.max(y - 2.5, 20), z = S / m.n;
      doc.setFillColor(0, 0, 0);
      for (let r = 0; r < m.n; r++) { let c = 0; while (c < m.n) { if (!m.dark(r, c)) { c++; continue; } let e = c; while (e < m.n && m.dark(r, e)) e++; doc.rect(X + c * z, yq + r * z, (e - c) * z + 0.01, z + 0.01, "F"); c = e; } }
      fnt("normal", 6.3); col(SUB); txt("GiroCode", X + S / 2, yq + S + 3.8, { align: "center" }); txt("mit der Banking-App scannen", X + S / 2, yq + S + 6.4, { align: "center" });
      const bx = X + S + 6; let by = yq + 4;
      fnt("bold", 9.3); col(INK); txt("Bezahlen per Überweisung", bx, by); by += 5;
      [["Empfänger", gc.name], ["IBAN", String(gc.iban).replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim()], ["BIC", gc.bic], ["Betrag", eur(gc.betrag)], ["Verwendungszweck", gc.zweck]]
        .filter(x => x[1]).forEach(([a, b]) => { fnt("normal", 9.3); col(SUB); txt(a, bx, by); col(INK); txt(String(b), bx + 34, by); by += 4.3; });
      y = Math.max(yq + S + 12, by + 3);
    }
  }
  (B.texte || []).filter(Boolean).forEach(absatz);
  y += 9.5; if (y + 4 > BOTTOM + 4) neueSeite();   // Gruß darf bis knapp über die Seitenzahl (267,7 mm) reichen
  fnt("normal", 9.3); txt("Mit freundlichen Grüßen", L + 1.4, y); y += 3.9;
  const g = B.gruss || f.name || "", gm = g.match(/^([A-ZÄÖÜ][a-zäöüß]+)([A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*)$/);
  fnt("bold", 9.3); if (gm) { txt(gm[1], L + 1.4, y); col(BLUE); txt(gm[2], L + 1.4 + doc.getTextWidth(gm[1]), y); col(INK); } else txt(g, L + 1.4, y);

  // ---- Fußzeile + Seitenzahl auf jeder Seite
  const spalten = fussSpalten(f);
  const xs = [L - 0.7, 63.9, 107.6, 151.2], seiten = doc.getNumberOfPages();
  for (let pg = 1; pg <= seiten; pg++) {
    doc.setPage(pg); fnt("normal", 7); col(INK);
    txt(`${pg}/${seiten}`, VR + 1.9, 267.7, { align: "right" });
    spalten.forEach((c, ci) => c.forEach((z, i) => txt(z, xs[ci], FOOT + i * 3.7)));
  }
  return doc;
}
