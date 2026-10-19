/*
 * RepairMobile Werkbank – App-Logik
 * Läuft als normales Browser-Skript. Daten liegen im localStorage dieses Browsers
 * (Backup/Wiederherstellen unter Einstellungen). Läuft die Seite als Claude-Artifact,
 * wird zusätzlich der Konto-Speicher genutzt.
 */
import BRAND_LOGO from "../assets/brandLogo.js";

/* Datei speichern: im Claude-Artifact über dessen Download-Funktion,
   sonst Teilen-Menü (iPhone/Android, z. B. WhatsApp, Mail, Dateien) oder normaler Download. */
async function getDownloader(){
  if (window.claude?.use) {
    const d = await window.claude.use("downloads").catch(() => null);
    if (d) return d;
  }
  return {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      try {
        const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
        const touch = matchMedia("(pointer: coarse)").matches;
        if (touch && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return { status: "saved" };
        }
      } catch (e) {
        if (e && e.name === "AbortError") throw { code: "cancelled" };
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return { status: "saved" };
    }
  };
}

let started = false;
export function startApp(){
  if (started) return;
  started = true;
  /* ---------- helpers ---------- */
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const eur = n => new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(+n||0);
  const pad = n => String(n).padStart(2,"0");
  const pad4 = n => String(n).padStart(4,"0");
  const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today = () => isoDay(new Date());
  const nowStamp = () => { const d=new Date(); return `${isoDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const deDate = s => { if(!s) return ""; const [y,m,d]=s.slice(0,10).split("-"); return `${d}.${m}.${y}`; };
  const deStamp = s => s ? `${s.slice(11,16)}, ${deDate(s)}` : "";
  const longDate = s => new Date(s.slice(0,10)+"T12:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const addDays = (s,n) => { const d=new Date(s+"T12:00"); d.setDate(d.getDate()+n); return isoDay(d); };
  const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const parseNum = v => { let s=String(v??"").trim(); if(s.includes(",")) s=s.replace(/\./g,"").replace(",","."); const n=parseFloat(s); return isNaN(n)?0:n; };
  const numIn = n => (n===""||n==null) ? "" : String(Math.round(+n*1000)/1000).replace(".", ",");
  const r2 = n => Math.round(n*100)/100;
  const hexRgb = h => { const m=h.replace("#",""); return [0,2,4].map(i=>parseInt(m.slice(i,i+2),16)); };
  const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  const ico = {
    user:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c.6-4 4-6.5 8-6.5s7.4 2.5 8 6.5z"/></svg>',
    clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    checkc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
    phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    left:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>',
    doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
    preview:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 3H6v18h6"/><path d="M14 3l4 4v4"/><path d="M9 8h5M9 12h3"/><circle cx="16.5" cy="16.5" r="3"/><path d="M21 21l-2.3-2.3"/></svg>',
    card:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.5 1.7-2.3 3-2.3s2.5.8 3 2.3M14 10h4M14 14h3"/></svg>',
    list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    pct:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
    hist:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
    send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/></svg>',
    share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>',
    sync:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 11a8 8 0 0 0-14.3-4.6L4 8M4 13a8 8 0 0 0 14.3 4.6L20 16"/><path d="M4 4v4h4M20 20v-4h-4"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    scan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9h8M8 12h8M8 15h5"/></svg>',
    cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    upl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>',
    dl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    text:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 10h16M4 14h10M4 18h7"/></svg>',
    table:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/></svg>'
  };
  function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("on"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("on"),2600); }

  const STATUS = { angenommen:{l:"Angenommen",n:1}, reparatur:{l:"In Reparatur",n:2}, fertig:{l:"Abholbereit",n:3}, abgeholt:{l:"Abgeholt",n:4} };
  const EINH = [["Stk.","Stück"],["Std.","Stunden"],["Min.","Minuten"],["psch.","Pauschal"],["Tag","Tage"],["km","Kilometer"],["m","Meter"]];
  const TYP = {
    rechnung:{l:"Rechnung", up:"RECHNUNG", pre:"RE", dateL:"Fällig am", make:"Als Rechnung erstellen"},
    angebot:{l:"Angebot", up:"ANGEBOT", pre:"AN", dateL:"Gültig bis", make:"Als Angebot erstellen"},
    kva:{l:"Kostenvoranschlag", up:"KOSTENVORANSCHLAG", pre:"KV", dateL:"Gültig bis", make:"Als Kostenvoranschlag erstellen"}
  };
  const DST = { entwurf:"Entwurf", offen:"Offen", versendet:"Versendet", bezahlt:"Bezahlt", ueberfaellig:"Überfällig", storniert:"Storniert", akzeptiert:"Angenommen", abgelehnt:"Abgelehnt" };
  const ACCENTS = {
    repair:{l:"RepairMobile-Rot", c:"#e31b23", d:"#ff5257", fd:"#ffffff", bar:"#ff4d55"},
    orange:{l:"Werkstatt-Orange", c:"#ec6a1e", d:"#ff8340", fd:"#1b0d03", bar:"#ff8a45"},
    navy:{l:"Navy-Blau", c:"#2563c9", d:"#6f9df0", fd:"#06101c", bar:"#7aa7f5"},
    gruen:{l:"Smaragdgrün", c:"#1d7d45", d:"#4cc683", fd:"#04170c", bar:"#4cd08a"},
    schwarz:{l:"Schwarz", c:"#111a27", d:"#e8eef6", fd:"#06101c", bar:"#ffffff"}
  };
  const LAYOUTS = {
    modern:{l:"Modern", d:"Farbstreifen, Tabelle mit Rahmen"},
    din:{l:"Klassisch", d:"DIN 5008, Faltmarken, Fensterumschlag"},
    kompakt:{l:"Kompakt", d:"Kleine Schrift, viele Positionen"},
    minimal:{l:"Minimal", d:"Viel Weißraum, großer Betrag oben"},
    block:{l:"Header-Block", d:"Farbiger Kopf mit Logo und Titel"},
    side:{l:"Zweispaltig", d:"Firmen- und Bankdaten in der Seitenleiste"},
    werkstatt:{l:"Werkstatt", d:"Gerätefeld, Arbeitslohn und Teile getrennt"},
    neutral:{l:"Neutral", d:"Logo mittig, Stammdaten rechts, Zebra-Tabelle"}
  };
  const TEXT_SUGGEST = {
    textRechnung:"Auf verbaute Ersatzteile gewähren wir zusätzlich 6 Monate Garantie. Ihre gesetzlichen Gewährleistungsrechte bleiben davon unberührt. Ausgenommen von der Garantie sind Schäden durch Sturz, Feuchtigkeit oder Eingriffe Dritter.",
    textAngebot:"Die Reparatur dauert in der Regel 1–2 Stunden. Müssen Ersatzteile bestellt werden, informieren wir Sie vorab über die Lieferzeit.",
    haftung:"Bitte sichern Sie Ihre Daten vor der Reparatur. Für Datenverlust haften wir nur bei Vorsatz oder grober Fahrlässigkeit. Bei Geräten mit Feuchtigkeits- oder Sturzschaden können während der Reparatur weitere, bereits angelegte Defekte sichtbar werden."
  };

  /* ---------- data store (private db, local fallback) ---------- */
  const COLLS = ["kunden","auftraege","rechnungen","teile","ausgaben"];
  const S = { firma:{}, kunden:[], auftraege:[], rechnungen:[], teile:[], ausgaben:[] };
  let mode = "local", dbRefs = null;
  const LS_KEY = "repairmobile-werkbank-v1";
  function lsLoad(){ try{ const raw=localStorage.getItem(LS_KEY); if(raw) Object.assign(S, JSON.parse(raw)); }catch(e){} for(const c of COLLS) if(!Array.isArray(S[c])) S[c]=[]; }
  function lsSave(){ if(mode!=="local") return; try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){} }
  function upsertLocal(coll, obj){ obj._upd=Date.now(); const arr=S[coll]; const i=arr.findIndex(x=>x.id===obj.id); if(i>=0) arr[i]=obj; else arr.push(obj); if(typeof cloudQueue==="function") cloudQueue(coll, obj.id, obj); }
  async function save(coll, obj){
    upsertLocal(coll, obj); lsSave(); render();
    if(mode==="db"){ const {id, ...body}=obj; try{ await dbRefs[coll].doc(id).set(body); }catch(e){ toast(e && e.code==="quota_exceeded" ? "Speicher voll – bitte alte Einträge löschen" : "Konnte nicht speichern, bitte erneut versuchen"); } }
  }
  async function remove(coll, id){
    S[coll]=S[coll].filter(x=>x.id!==id); lsSave(); render(); cloudQueue(coll, id, null, true);
    if(mode==="db"){ try{ await dbRefs[coll].doc(id).delete(); }catch(e){ toast("Löschen fehlgeschlagen"); } }
  }
  async function saveFirma(f){
    f._upd=Date.now(); S.firma=f; lsSave(); render(); cloudQueue("firma", "main", f); if(typeof gemKeyRemember==="function") gemKeyRemember();
    if(mode==="db"){ try{ await dbRefs.firma.set(f); }catch(e){ toast("Firmendaten nicht gespeichert – Logo evtl. zu groß"); } }
  }
  const setFirma = patch => saveFirma({...S.firma, ...patch});
  async function connectDb(){
    if(!window.claude || !window.claude.use) return;
    try{
      const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
      if(!db || !user) return;
      const id = await user.id(); if(!id) return;
      const base = db.doc(`data/users/${id}/app`);
      const refs = { firma: db.doc(`data/users/${id}/firma`) };
      COLLS.forEach(c => refs[c] = base.collection(c)); refs.bilder = base.collection("belegbilder");
      const fsnap = await refs.firma.get();
      const local = JSON.parse(JSON.stringify(S));
      dbRefs = refs; mode = "db";
      if(!fsnap.exists){
        await refs.firma.set(Object.keys(local.firma).length ? local.firma : {created:today()});
        for(const c of COLLS) for(const o of local[c]){ const {id:k,...b}=o; await refs[c].doc(k).set(b); }
      } else S.firma = fsnap.data() ? {...fsnap.data()} : {};
      refs.firma.onSnapshot(s => { if(s.exists){ S.firma={...s.data()}; render(); } }, ()=>{});
      COLLS.forEach(c => refs[c].onSnapshot(q => { S[c] = q.docs.map(d => ({id:d.id, ...d.data()})); render(); }, ()=>{}));
      render();
    }catch(e){ mode="local"; dbRefs=null; }
  }

  /* ---------- theme + branding ---------- */
  const HOST_THEME = document.documentElement.getAttribute("data-theme");
  function getTheme(){ try{ return localStorage.getItem("rm-theme") || "system"; }catch(e){ return "system"; } }
  function applyTheme(t=getTheme()){
    const root=document.documentElement;
    if(t==="light"||t==="dark") root.setAttribute("data-theme", t);
    else if(HOST_THEME) root.setAttribute("data-theme", HOST_THEME); else root.removeAttribute("data-theme");
  }
  function setTheme(t){ try{ localStorage.setItem("rm-theme", t); }catch(e){} applyTheme(t); render(); }
  function ensureOwnLogo(){
    // Früher war das RepairMobile-Logo Standard für alle. Jetzt nur noch im RepairMobile-Konto – einmalig fest eingetragen.
    if(typeof CLOUD!=="undefined" && CLOUD.user && !CLOUD.ready) return;   // erst nach dem Laden aus der Cloud entscheiden
    const f=S.firma; if(f.logo || f.logoMig || !/repair\s*mobile/i.test(f.name||"")) return;
    queueMicrotask(()=>{ if(!S.firma.logo && !S.firma.logoMig) setFirma({logo:BRAND_LOGO, logoMig:1}); });
  }
  function applyBranding(){
    ensureOwnLogo();
    const a = ACCENTS[S.firma.akzent] || ACCENTS.repair; const st=document.documentElement.style;
    st.setProperty("--accent-l", a.c); st.setProperty("--accent-d", a.d);
    st.setProperty("--accent-fg-l", "#ffffff"); st.setProperty("--accent-fg-d", a.fd);
    st.setProperty("--doc-accent", a.c); st.setProperty("--tab-on", a.bar);
  }
  // Belege zeigen nur das eigene Logo der Firma – ohne Logo steht dort der Firmenname.
  const docLogo = () => S.firma.logo || "";
  const pdfLayout = () => LAYOUTS[S.firma.pdfLayout] ? S.firma.pdfLayout : "modern";

  /* ---------- derived ---------- */
  const kunde = id => S.kunden.find(k=>k.id===id);
  const kName = id => kunde(id)?.name || "Ohne Kunde";
  const sumPos = p => (p||[]).reduce((a,x)=>a+(+x.menge||0)*(+x.preis||0),0);
  const NR_DEF = { job:"JOB-", rechnung:"RE-", angebot:"AN-", kva:"KV-" };
  const NR_KEY = { job:"preJob", rechnung:"preRe", angebot:"preAn", kva:"preKv" };
  function nrPrefix(kind, f=S.firma){ const v=f[NR_KEY[kind]]; return (v==null || String(v).trim()==="") ? NR_DEF[kind] : String(v).trim(); }
  const nrWithYear = (f=S.firma) => f.nrJahr !== false;
  // Stamm einer neuen Nummer, z. B. "RE-2026-" (mit Jahr) oder "RE-" (ohne Jahr). Aufträge immer ohne Jahr.
  function nrStem(kind, f=S.firma, y=new Date().getFullYear()){ const p=nrPrefix(kind,f); return kind!=="job" && nrWithYear(f) ? `${p}${y}-` : p; }
  // höchste vergebene laufende Nummer zu genau diesem Stamm (andere/alte Formate zählen nicht mit)
  function nrMax(list, stem){ let m=0; for(const x of list){ const n=String(x.nr||""); if(!n.startsWith(stem)) continue; const rest=n.slice(stem.length); if(/^\d+$/.test(rest)) m=Math.max(m, parseInt(rest,10)); } return m; }
  function readNrForm(){ const t=id=>($("#"+id)?.value||"").replace(/\s+/g,"").toUpperCase(); return { preJob:t("cPreJob"), preRe:t("cPreRe"), preAn:t("cPreAn"), preKv:t("cPreKv"), nrJahr:$("#cNrJahr")?.checked!==false }; }
  // laufende Nummer = höchste bisher vergebene (egal mit welchem Kürzel) + 1; mit Jahreszahl nur Belege aus diesem Jahr
  function runNo(list, y){ return Math.max(0, ...list.map(x=>seqNo(x.nr, y))); }
  function freeNr(stem, n, list){ const taken=new Set(list.map(x=>String(x.nr||""))); let nr; do{ nr=stem+pad4(n++); }while(taken.has(nr)); return nr; }
  const nextJobNrFor = f => freeNr(nrStem("job",f), 1+Math.max(runNo(S.auftraege,-1), nrMax(S.auftraege, nrStem("job",f))), S.auftraege);
  const nextJobNr = () => nextJobNrFor(S.firma);
  const dTyp = r => r.typ || "rechnung";
  const dKu = r => r.ku ?? r.kleinunternehmer ?? (r.mwst===0 && !!S.firma.kleinunternehmer);
  const dMwst = r => dKu(r) ? 0 : (r.mwst ?? 19);
  const dBrutto = r => r.brutto ?? true;
  function nextNr(typ, f=S.firma){ const y=new Date().getFullYear(); const stem=nrStem(typ,f,y);
    const all=S.rechnungen.filter(r=>dTyp(r)===typ && r.nr), scope = nrWithYear(f) ? all.filter(r=>(r.datum||"").startsWith(String(y))) : all;
    const used=Math.max(runNo(scope, y), nrMax(all, stem));
    const start = typ==="rechnung" && +f.reStartYear===y ? (+f.reStart||1)-1 : 0; return freeNr(stem, 1+Math.max(used,start), all); }
  const shownNr = r => r.nr || `${nrStem(dTyp(r))}····`;
  function calc(r){
    const sum=r2(sumPos(r.positionen)); const rab=r2(sum*(+r.rabatt||0)/100); const base=r2(sum-rab); const p=dMwst(r);
    if(!p) return {sum, rab, netto:base, mwst:0, brutto:base, p};
    if(dBrutto(r)){ const netto=r2(base/(1+p/100)); return {sum, rab, netto, mwst:r2(base-netto), brutto:base, p}; }
    const m=r2(base*p/100); return {sum, rab, netto:base, mwst:m, brutto:r2(base+m), p};
  }
  function dStatus(r){
    const s = r.status || (r.bezahlt ? "bezahlt" : "offen");
    if(dTyp(r)==="rechnung" && (s==="offen"||s==="versendet") && r.faellig && r.faellig<today()) return "ueberfaellig";
    return s;
  }
  const defaultNote = typ => (typ==="rechnung" ? S.firma.textRechnung : S.firma.textAngebot) || "";

  /* ---------- UI state ---------- */
  const UI = { sel:null, selVis:{kunden:[],teile:[],rechnungen:[]}, view:"auftraege", filter:"offen", q:"", calMonth:today().slice(0,7), calDay:today(), docSeg:"rechnungen", docFilter:"alle", ausMonth:today().slice(0,7), csvYear:String(new Date().getFullYear()), csvMonth:"" };
  const titles = {auftraege:"Aufträge", kalender:"Kalender", rechnungen:"Rechnungen", kunden:"Kunden", mehr:"Einstellungen"};
  const APP_VER="46";                                   // bei jeder Auslieferung hochzählen – steht unten in den Einstellungen
  const TAB_ORDER=["auftraege","kalender","rechnungen","kunden","mehr"];
  const reducedMotion = () => { try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };
  const EASE_OUT="cubic-bezier(.2,.8,.2,1)", EASE_IN="cubic-bezier(.4,0,1,1)";
  let navSeq=0;
  function setActiveTab(v){
    $("#tabs").style.setProperty("--i", Math.max(0,TAB_ORDER.indexOf(v)));
    $$(".tab").forEach(t => t.dataset.v===v ? t.setAttribute("aria-current","page") : t.removeAttribute("aria-current"));
  }
  function switchView(v){
    if(v===UI.view){ window.scrollTo({top:0, behavior:reducedMotion()?"auto":"smooth"}); return; }
    const dir = TAB_ORDER.indexOf(v) > TAB_ORDER.indexOf(UI.view) ? 1 : -1;
    const old = $("#main .view"), seq = ++navSeq;
    UI.view=v; UI.q=""; UI.sel=null; setActiveTab(v);
    const icon=$(`.tab[data-v="${v}"] svg`);
    if(!reducedMotion() && icon && icon.animate) icon.animate([{transform:"scale(1)"},{transform:"translateY(-3px) scale(1.18)"},{transform:"scale(1)"}],{duration:420,easing:"cubic-bezier(.3,1.5,.5,1)"});
    if(reducedMotion() || !old || !old.animate){ render(); window.scrollTo(0,0); return; }
    const fromT=old.style.transform||"none", fromO=old.style.opacity||1;                 // nach Wischgeste dort weitermachen, wo der Finger war
    const out = old.animate([{opacity:fromO, transform:fromT},{opacity:0, transform:`translateX(${-dir*60}px)`}], {duration:fromT==="none"?150:120, easing:EASE_IN, fill:"forwards"});
    out.onfinish = () => { if(seq!==navSeq) return; window.scrollTo(0,0); UI.enterDir=dir; render(); };
  }
  function animateEnter(view, dir){
    if(!view || !view.animate || reducedMotion()) return;
    view.animate([{opacity:0, transform:`translateX(${dir*34}px)`},{opacity:1, transform:"none"}], {duration:340, easing:EASE_OUT});
    [...view.children].slice(0,9).forEach((c,i)=> c.animate([{opacity:0, transform:"translateY(12px)"},{opacity:1, transform:"none"}], {duration:360, delay:50+i*38, easing:EASE_OUT, fill:"backwards"}));
    const h=$("#viewTitle"); if(h.animate) h.animate([{opacity:0, transform:`translateY(6px)`},{opacity:1, transform:"none"}], {duration:300, easing:EASE_OUT});
  }
  let TAB_DRAG_END=0;
  $("#tabs").addEventListener("click", e => { if(performance.now()-TAB_DRAG_END<450) return; const b=e.target.closest(".tab"); if(!b) return; switchView(b.dataset.v); });
  /* Mit dem Finger über die Leiste streichen: Blase folgt dem Finger, Loslassen öffnet den Tab darunter */
  (()=>{ const bar=$("#tabs"), pill=bar.querySelector(".tab-pill"); let d=null;
    const geo = () => { const r=bar.getBoundingClientRect(), cs=getComputedStyle(bar), tp=parseFloat(cs.getPropertyValue("--tp"))||6, bl=parseFloat(cs.borderLeftWidth)||0;
      const inner=r.width-2*bl-2*tp; return {left:r.left+bl+tp, inner, cw:inner/TAB_ORDER.length, tp}; };
    const idxAt = x => { const g=geo(); return Math.max(0, Math.min(TAB_ORDER.length-1, Math.floor((x-g.left)/g.cw))); };
    const follow = x => { const g=geo(); const l=Math.max(0, Math.min(g.inner-g.cw, x-g.left-g.cw/2));
      pill.style.left=(g.tp+l)+"px"; const i=idxAt(x); if(i!==d.i){ d.i=i; setActiveTab(TAB_ORDER[i]); } };
    bar.addEventListener("touchstart", e => { if(e.touches.length!==1) return; const t=e.touches[0]; d={x:t.clientX, y:t.clientY, on:false, i:TAB_ORDER.indexOf(UI.view)}; }, {passive:true});
    bar.addEventListener("touchmove", e => {
      if(!d) return; const t=e.touches[0];
      if(!d.on){ if(Math.abs(t.clientX-d.x)<8) return; d.on=true; bar.classList.remove("compact"); bar.classList.add("drag"); }
      if(e.cancelable) e.preventDefault();                                              // Seite nicht mitscrollen
      follow(t.clientX);
    }, {passive:false});
    const finish = cancel => { if(!d) return; const was=d; d=null; if(!was.on) return;
      TAB_DRAG_END=performance.now(); bar.classList.remove("drag"); pill.style.left="";
      const v=TAB_ORDER[was.i]; if(cancel || v===UI.view) setActiveTab(UI.view); else switchView(v); };
    bar.addEventListener("touchend", () => finish(false), {passive:true});
    bar.addEventListener("touchcancel", () => finish(true), {passive:true});
  })();
  /* Wischen nach links/rechts → nächster/vorheriger Tab.
     Robust für iPhone: lauscht früh (Capture) auf Touch- UND Pointer-Eingaben, nur eindeutige Ausschlüsse. */
  (()=>{ let sw=null, lastFire=0;
    const BLOCK="input,textarea,select,[contenteditable],.chips,.nodrag,#tabs,.top,.sheet,.picker,.viewer,.menu,.auth,.bfull,.tour,.selbar,.fab,.scrim,.splash";
    const open = id => { const e=document.getElementById(id); return !!e && !e.hidden; };
    const start = (x,y,el,src) => {
      sw=null; if(UI.sel || open("sheet") || open("picker") || open("viewer") || open("tour")) return;
      if(el && el.closest && el.closest(BLOCK)) return;
      sw={x, y, t:performance.now(), lock:0, dx:0, src};
    };
    const move = (x,y,src) => {
      if(!sw || sw.src!==src) return; const dx=x-sw.x, dy=y-sw.y;
      if(!sw.lock){ if(Math.abs(dx)<12 && Math.abs(dy)<12) return; sw.lock = Math.abs(dx)>Math.abs(dy) ? 1 : -1; }
      if(sw.lock!==1) return;
      sw.dx=dx; const i=TAB_ORDER.indexOf(UI.view), edge=(dx>0&&i===0)||(dx<0&&i===TAB_ORDER.length-1);
      const v=$("#main .view"); if(v && !reducedMotion()){ const m=edge?dx*.12:dx*.35; v.style.transform=`translateX(${m}px)`; v.style.opacity=String(1-Math.min(.35,Math.abs(m)/300)); }
    };
    const end = src => {
      if(!sw || sw.src!==src) return;
      const s0=sw; sw=null; const v=$("#main .view");
      const reset = () => { if(v){ v.style.transform=""; v.style.opacity=""; } };
      if(s0.lock!==1){ reset(); return; }
      const i=TAB_ORDER.indexOf(UI.view), dx=s0.dx, fast=Math.abs(dx)/(performance.now()-s0.t) > .35;
      const j = (Math.abs(dx)>55 || (fast && Math.abs(dx)>28)) ? i+(dx<0?1:-1) : i;
      if(j!==i && j>=0 && j<TAB_ORDER.length && performance.now()-lastFire>350){ lastFire=performance.now(); if(reducedMotion()) reset(); switchView(TAB_ORDER[j]); return; }
      if(v && v.animate && v.style.transform){ const from=v.style.transform, op=v.style.opacity||1; reset();
        v.animate([{transform:from, opacity:op},{transform:"none", opacity:1}], {duration:260, easing:EASE_OUT}); } else reset();
    };
    const O={passive:true, capture:true};
    window.addEventListener("touchstart", e => { if(e.touches.length!==1){ sw=null; return; } const t=e.touches[0]; start(t.clientX,t.clientY,e.target,"t"); }, O);
    window.addEventListener("touchmove",  e => { const t=e.touches[0]; if(t) move(t.clientX,t.clientY,"t"); }, O);
    window.addEventListener("touchend",   () => end("t"), O);
    window.addEventListener("touchcancel",() => end("t"), O);
    // Rückfall nur für Geräte ohne Touch-Ereignisse (sonst würden sich beide gegenseitig stören)
    if("ontouchstart" in window) return;
    window.addEventListener("pointerdown", e => { if(e.pointerType==="touch") start(e.clientX,e.clientY,e.target,"p"); }, O);
    window.addEventListener("pointermove", e => { if(e.pointerType==="touch") move(e.clientX,e.clientY,"p"); }, O);
    window.addEventListener("pointerup",   e => { if(e.pointerType==="touch") end("p"); }, O);
    window.addEventListener("pointercancel",e => { if(e.pointerType==="touch") end("p"); }, O);
  })();
  $("#fab").addEventListener("click", () => {
    if(UI.view==="kunden") openKunde(); else if(UI.view==="rechnungen" && UI.docSeg==="ausgaben") newAusgabe(); else if(UI.view==="rechnungen") openDocEditor({typ: UI.docSeg==="angebote"?"angebot":"rechnung"});
    else if(UI.view==="mehr") openTeil(); else openAuftrag(null, UI.view==="kalender" ? UI.calDay : null);
  });

  /* ---------- render ---------- */
  function render(){
    applyBranding();
    $("#viewTitle").textContent = UI.view==="rechnungen" && UI.docSeg==="ausgaben" ? "Ausgaben" : titles[UI.view];
    setActiveTab(UI.view);
    $("#fab").hidden = !!UI.sel;
    $("#fab").setAttribute("aria-label", {auftraege:"Neuer Auftrag",kalender:"Neuer Termin",rechnungen:UI.docSeg==="ausgaben"?"Beleg erfassen":"Neues Dokument",kunden:"Neuer Kunde",mehr:"Neues Ersatzteil"}[UI.view]);
    const m = $("#main"); const keep = document.activeElement?.id; const sel = keep && document.activeElement.selectionStart;
    m.innerHTML = `<div class="view">${({auftraege:vAuftraege,kalender:vKalender,rechnungen:vRechnungen,kunden:vKunden,mehr:vMehr})[UI.view]()}</div>`;
    if(UI.enterDir){ const d=UI.enterDir; UI.enterDir=0; animateEnter($("#main .view"), d); }
    if(keep==="q"){ const q=$("#q"); if(q){ q.focus(); try{q.setSelectionRange(sel,sel);}catch(e){} } }
    bindView();
  }

  function jobCard(a){
    const t = a.termin ? `${deDate(a.termin)}${a.termin.length>10?", "+a.termin.slice(11,16):""}` : "";
    return `<button class="card st-${a.status}" data-job="${a.id}">
      <div class="row"><span class="mono jobnr">#${esc(a.nr)}</span><span class="pill s-${a.status}">${STATUS[a.status].l}</span></div>
      <h3>${esc(a.geraet||"Gerät")}</h3>
      <div class="meta"><span>${ico.user}${esc(kName(a.kundeId))}</span>${t?`<span>${ico.clock}${t}</span>`:""}${a.erledigt?`<span style="color:var(--green)">${ico.check}repariert ${deDate(a.erledigt)}</span>`:""}</div>
      ${a.problem?`<div class="meta">${esc(a.problem.length>90?a.problem.slice(0,90)+"…":a.problem)}</div>`:""}
    </button>`;
  }

  function vAuftraege(){
    const groups = {offen:a=>["angenommen","reparatur"].includes(a.status), fertig:a=>a.status==="fertig", abgeholt:a=>a.status==="abgeholt", alle:()=>true};
    const q = UI.q.trim().toLowerCase();
    const list = S.auftraege.filter(groups[UI.filter]).filter(a => !q || [a.geraet,a.nr,a.problem,a.imei,kName(a.kundeId)].join(" ").toLowerCase().includes(q))
      .sort((x,y)=> (x.termin||x.created||"").localeCompare(y.termin||y.created||"") * (UI.filter==="abgeholt"?-1:1));
    const cnt = k => S.auftraege.filter(groups[k]).length;
    const chips = [["offen","Offen"],["fertig","Abholbereit"],["abgeholt","Abgeholt"],["alle","Alle"]]
      .map(([k,l])=>`<button class="chip" data-f="${k}" aria-pressed="${UI.filter===k}">${l} (${cnt(k)})</button>`).join("");
    if(!S.auftraege.length) return `${hintHtml("auftraege","<b>Ihre Aufträge.</b> Jedes Gerät, das Sie annehmen, wird ein Auftrag – mit Termin, Fehler, Ersatzteilen und am Ende der Rechnung.")}
      <div class="empty">${bigIcon()}<h2>Noch keine Aufträge</h2><p>Legen Sie das erste Gerät an, z. B. „iPhone 13 Pro – Display“. Termin und Reparaturdatum landen automatisch im Kalender.</p>
      <div class="btnrow" style="justify-content:center"><button class="btn accent" data-act="newjob">+ Ersten Auftrag anlegen</button><button class="btn ghost" data-act="examples">Beispiel ansehen</button></div></div>`;
    let html = `${hintHtml("auftraege","<b>Ihre Aufträge.</b> Tippen Sie auf einen Auftrag, um den Status zu ändern, Teile einzutragen oder Rechnung und Kostenvoranschlag zu erstellen.")}
      <label class="search">${ico.search}<input id="q" type="search" placeholder="Gerät, Kunde, IMEI suchen…" value="${esc(UI.q)}"></label>
      <div class="chips">${chips}</div>`;
    if(!list.length) return html + `<div class="empty"><p>Keine Aufträge in dieser Ansicht.</p></div>`;
    let last=null;
    for(const a of list){ const d=(a.termin||a.created||"").slice(0,10); if(d!==last){ html+=`<div class="daylabel">${d?longDate(d):"Ohne Termin"}</div>`; last=d; } html+=jobCard(a); }
    return html;
  }

  function bigIcon(){ return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="16" y="6" width="32" height="52" rx="7" fill="var(--grey-soft)" stroke="var(--faint)" stroke-width="2"/><path d="M28 50h8" stroke="var(--faint)" stroke-width="3" stroke-linecap="round"/><path d="M8 30h22l-3 8H5z" fill="var(--accent)"/><path d="M34 14l-6 36" stroke="var(--hi)" stroke-width="5" stroke-linecap="round"/></svg>`; }

  let hidden = {}; try{ hidden = JSON.parse(localStorage.getItem("rm-hints")||"{}"); }catch(e){}
  function hintHtml(k, txt){ return hidden[k] ? "" : `<div class="hint"><span>${txt}</span><button data-hint="${k}" aria-label="Hinweis schließen">×</button></div>`; }

  function eventsOn(day){
    const ev=[];
    for(const a of S.auftraege){
      if(a.termin && a.termin.slice(0,10)===day) ev.push({k:"t", t:a.termin.length>10?a.termin.slice(11,16):"", a, l:"Termin"});
      if(a.erledigt===day) ev.push({k:"r", t:"", a, l:"Repariert"});
      if(a.abgeholtAm===day) ev.push({k:"a", t:"", a, l:"Abgeholt"});
    }
    return ev.sort((x,y)=>(x.t||"99").localeCompare(y.t||"99"));
  }
  function vKalender(){
    const [y,m] = UI.calMonth.split("-").map(Number);
    const first = new Date(y, m-1, 1); const startOff = (first.getDay()+6)%7;
    const start = new Date(y, m-1, 1-startOff);
    let cells = ["Mo","Di","Mi","Do","Fr","Sa","So"].map(w=>`<div class="wd">${w}</div>`).join("");
    for(let i=0;i<42;i++){
      const d = new Date(start); d.setDate(start.getDate()+i); const s=isoDay(d);
      if(i>=35 && d.getMonth()!==m-1) break;
      const ev = eventsOn(s);
      const dots = ev.slice(0,6).map(e=>`<span class="dot ${e.k}"></span>`).join("");
      cells += `<button class="day${d.getMonth()!==m-1?" out":""}${s===today()?" today":""}${d.getDay()===0?" sun":""}" data-day="${s}" aria-pressed="${s===UI.calDay}" aria-label="${longDate(s)}, ${ev.length} Einträge"><span class="d">${d.getDate()}</span><span class="dots">${dots}</span></button>`;
    }
    const evs = eventsOn(UI.calDay);
    const monthName = first.toLocaleDateString("de-DE",{month:"long",year:"numeric"});
    const repMonth = S.auftraege.filter(a=>a.erledigt && a.erledigt.startsWith(UI.calMonth)).length;
    const terMonth = S.auftraege.filter(a=>a.termin && a.termin.startsWith(UI.calMonth)).length;
    return `${hintHtml("kalender","<b>Kalender.</b> Blau = Termin mit dem Kunden, Grün = an dem Tag repariert. Tippen Sie auf einen Tag und dann auf +, um dort einen Termin anzulegen.")}
      <div class="calhead"><h2>${monthName}</h2><button class="navbtn" data-m="-1" aria-label="Voriger Monat">${ico.left}</button><button class="btn ghost sm" data-m="0">Heute</button><button class="navbtn" data-m="1" aria-label="Nächster Monat">${ico.right}</button></div>
      <div class="stats"><div class="stat"><b class="num">${terMonth}</b><small>Termine im Monat</small></div><div class="stat"><b class="num">${repMonth}</b><small>Geräte repariert</small></div></div>
      <div class="grid">${cells}</div>
      <div class="legend"><span><i class="dot t"></i>Termin</span><span><i class="dot r"></i>Repariert</span><span><i class="dot a"></i>Abgeholt</span></div>
      <div class="daylabel">${longDate(UI.calDay)}</div>
      <div id="dayList" style="display:flex;flex-direction:column;gap:14px">${evs.length ? evs.map(e=>`<button class="card" data-job="${e.a.id}"><div class="evt"><span class="time">${e.t||"—"}</span><div style="min-width:0;flex:1"><span class="kind ${e.k}">${e.l}</span><h3>${esc(e.a.geraet)}</h3><div class="meta"><span>${ico.user}${esc(kName(e.a.kundeId))}</span><span class="mono">#${esc(e.a.nr)}</span></div></div><span class="pill s-${e.a.status}">${STATUS[e.a.status].l}</span></div></button>`).join("")
        : `<div class="card" style="align-items:flex-start"><span style="color:var(--muted)">Nichts eingetragen.</span><button class="btn sm" data-act="newjobday">+ Termin an diesem Tag</button></div>`}</div>`;
  }

  function docCard(r){
    const st=dStatus(r), t=dTyp(r);
    const inner = `<div class="row"><span class="mono jobnr">${esc(shownNr(r))}</span><span class="pill s-${st}">${DST[st]}</span></div>
      <div class="row"><h3>${esc(kName(r.kundeId))}</h3><strong class="num" style="font-size:17px">${eur(calc(r).brutto)}</strong></div>
      <div class="meta">${t!=="rechnung"?`<span class="tag">${TYP[t].l}</span>`:""}<span>${ico.cal}${deDate(r.datum)}</span>${r.geraet?`<span>${ico.phone}${esc(r.geraet)}</span>`:""}</div>`;
    return UI.sel?.kind==="rechnungen" && UI.view==="rechnungen" ? pickWrap("rechnungen", r.id, inner) : `<button class="card" data-doc="${r.id}">${inner}</button>`;
  }
  function vRechnungen(){
    const isR = UI.docSeg==="rechnungen";
    const seg = `<div class="seg seg3"><button data-seg="rechnungen" aria-pressed="${isR}">Rechnungen</button><button data-seg="angebote" aria-pressed="${UI.docSeg==="angebote"}">Angebote &amp; KVA</button><button data-seg="ausgaben" aria-pressed="${UI.docSeg==="ausgaben"}">Ausgaben</button></div>`;
    if(UI.docSeg==="ausgaben") return vAusgaben(seg);
    const all = S.rechnungen.filter(r => isR ? dTyp(r)==="rechnung" : dTyp(r)!=="rechnung").sort((a,b)=>(b.datum||"").localeCompare(a.datum||"") || (b.nr||"").localeCompare(a.nr||""));
    const F = isR
      ? {alle:()=>true, entwurf:r=>dStatus(r)==="entwurf", offen:r=>["offen","versendet","ueberfaellig"].includes(dStatus(r)), bezahlt:r=>dStatus(r)==="bezahlt", storniert:r=>dStatus(r)==="storniert"}
      : {alle:()=>true, entwurf:r=>dStatus(r)==="entwurf", offen:r=>["offen","versendet"].includes(dStatus(r)), akzeptiert:r=>dStatus(r)==="akzeptiert", abgelehnt:r=>dStatus(r)==="abgelehnt"};
    if(!F[UI.docFilter]) UI.docFilter="alle";
    const labels = {alle:"Alle", entwurf:"Entwurf", offen:"Offen", bezahlt:"Bezahlt", storniert:"Storniert", akzeptiert:"Angenommen", abgelehnt:"Abgelehnt"};
    const chips = Object.keys(F).map(k=>`<button class="chip" data-df="${k}" aria-pressed="${UI.docFilter===k}">${labels[k]} (${all.filter(F[k]).length})</button>`).join("");
    const sumOf = fn => all.filter(fn).reduce((s,r)=>s+calc(r).brutto,0);
    const tri = isR
      ? `<div class="tri"><div><small>Offen</small><b class="c-blue">${eur(sumOf(r=>["offen","versendet","ueberfaellig"].includes(dStatus(r))))}</b></div><div><small>Überfällig</small><b class="c-red">${eur(sumOf(r=>dStatus(r)==="ueberfaellig"))}</b></div><div><small>Bezahlt</small><b class="c-green">${eur(sumOf(r=>dStatus(r)==="bezahlt"))}</b></div></div>`
      : `<div class="tri"><div><small>Offen</small><b class="c-blue">${eur(sumOf(r=>["offen","versendet"].includes(dStatus(r))))}</b></div><div><small>Angenommen</small><b class="c-green">${eur(sumOf(r=>dStatus(r)==="akzeptiert"))}</b></div><div><small>Entwürfe</small><b>${all.filter(r=>dStatus(r)==="entwurf").length}</b></div></div>`;
    if(!all.length) return `${seg}${isR?hintHtml("rechnungen","<b>Rechnungen</b> erstellen Sie mit dem + oder direkt aus einem Auftrag. Firmendaten und Bankverbindung tragen Sie unter Einstellungen ein."):""}
      <div class="empty">${bigIcon()}<h2>${isR?"Noch keine Rechnungen":"Noch keine Angebote"}</h2><p>${isR?"Tippen Sie auf +, wählen Sie Kunde und Positionen, und sehen Sie sich das Blatt vor dem Erstellen in der Vorschau an.":"Angebote und Kostenvoranschläge erstellen Sie mit dem +. Wird ein Angebot angenommen, machen Sie mit einem Tipp eine Rechnung daraus."}</p>
      <div class="btnrow" style="justify-content:center"><button class="btn accent" data-act="newdoc">+ ${isR?"Rechnung":"Angebot"} erstellen</button>${isR?`<button class="btn ghost" data-act="importDocs">${ico.upl} Rechnungen importieren</button>`:""}</div></div>`;
    const list = UI.selVis.rechnungen = all.filter(F[UI.docFilter]);
    let html = `${seg}<div class="iobar"><span class="cnt">${all.length} ${isR?(all.length===1?"Rechnung":"Rechnungen"):(all.length===1?"Beleg":"Belege")}</span>${isR?`<button class="btn ghost sm" data-act="importDocs">${ico.upl} Importieren</button>`:""}<button class="btn ghost sm" data-act="exportDocs">${ico.dl} Exportieren ▾</button>${UI.sel?.kind==="rechnungen" ? `<button class="btn sm" data-act="selDone">Fertig</button>` : `<button class="btn ghost sm" data-act="selStart" data-kind="rechnungen">${ico.checkc} Auswählen</button>`}</div><div class="chips">${chips}</div>${tri}`, last=null;
    if(!list.length) return html + `<div class="empty"><p>Nichts in dieser Ansicht.</p></div>`;
    for(const r of list){ if(r.datum!==last){ html+=`<div class="daylabel">${r.datum?longDate(r.datum):"Ohne Datum"}</div>`; last=r.datum; } html+=docCard(r); }
    return html + selBar("rechnungen");
  }

  function vKunden(){
    const q = UI.q.trim().toLowerCase();
    const list = UI.selVis.kunden = [...S.kunden].sort((a,b)=>(a.name||"").localeCompare(b.name||"","de")).filter(k=>!q || [k.name,k.firma,k.tel,k.mail,k.ort,k.plz,kundenNr(k)].join(" ").toLowerCase().includes(q));
    if(!S.kunden.length) return `<div class="empty">${bigIcon()}<h2>Noch keine Kunden</h2><p>Kunden legen Sie hier an, direkt beim Auftrag, oder Sie übernehmen Ihre Kontaktliste als CSV (z. B. aus sevdesk oder Excel).</p><div class="btnrow" style="justify-content:center"><button class="btn accent" data-act="newkunde">+ Kunde anlegen</button><button class="btn ghost" data-act="importKunden">${ico.upl} Kontakte importieren</button></div></div>`;
    return `${ioBar("kunden", S.kunden.length, "Kontakt", "Kontakte")}<label class="search">${ico.search}<input id="q" type="search" placeholder="Name, Nr., Ort, Telefon suchen…" value="${esc(UI.q)}"></label>
      ${list.map(k=>{ const n=S.auftraege.filter(a=>a.kundeId===k.id).length; return pickWrap("kunden", k.id, `<div class="row"><h3><span class="mono jobnr" style="margin-right:8px">${esc(kundenNr(k))}</span>${esc(k.name)}</h3><span class="pill s-abgeholt">${n} Auftr${n===1?"ag":"äge"}</span></div>
      <div class="meta">${k.firma&&k.firma!==k.name?`<span>${esc(k.firma)}</span>`:""}${k.tel?`<span>${ico.phone}${esc(k.tel)}</span>`:""}${k.ort?`<span>${k.land&&!/^(de|deutschland|germany)$/i.test(k.land)?esc(landCode(k.land))+"-":""}${esc(k.plz||"")} ${esc(k.ort)}</span>`:""}</div>`); }).join("")}${selBar("kunden")}`;
  }

  /* small layout thumbnails for the PDF-Design picker */
  function layThumb(k){
    const a = (ACCENTS[S.firma.akzent]||ACCENTS.repair).c;
    const L = {
      modern:`<rect width="60" height="3" fill="${a}"/><rect x="6" y="8" width="18" height="5" rx="1" fill="#0c2340"/><rect x="6" y="22" width="20" height="2" fill="#9aa2ad"/><rect x="6" y="25" width="16" height="2" fill="#9aa2ad"/><rect x="5" y="36" width="50" height="22" rx="2" fill="none" stroke="#0c2340" stroke-width="1"/><rect x="5" y="36" width="50" height="4" fill="#eef3f8"/><rect x="36" y="62" width="19" height="3" fill="${a}"/>`,
      din:`<rect x="8" y="6" width="18" height="5" fill="#0c2340"/><rect x="8" y="20" width="22" height="2" fill="#9aa2ad"/><rect x="8" y="23" width="18" height="2" fill="#9aa2ad"/><rect x="38" y="20" width="14" height="6" fill="#d5d9df"/><line x1="1" y1="30" x2="4" y2="30" stroke="#9aa2ad"/><line x1="1" y1="56" x2="4" y2="56" stroke="#9aa2ad"/><rect x="8" y="36" width="44" height="1" fill="#151b24"/><rect x="8" y="40" width="44" height="1" fill="#d5d9df"/><rect x="8" y="44" width="44" height="1" fill="#d5d9df"/><rect x="36" y="62" width="16" height="3" fill="#151b24"/>`,
      neutral:`<rect x="21" y="4" width="18" height="6" fill="#0c2340"/><rect x="33" y="5" width="6" height="2.5" fill="#29aae1"/><rect x="5" y="15" width="18" height="1" fill="#151b24"/><rect x="5" y="18" width="14" height="1.5" fill="#9aa2ad"/><rect x="5" y="21" width="12" height="1.5" fill="#9aa2ad"/>${[15,17.5,20,22.5].map(y=>`<rect x="36" y="${y}" width="7" height="1" fill="#b8bec6"/><rect x="45" y="${y}" width="9" height="1" fill="#151b24"/>`).join("")}<rect x="5" y="30" width="22" height="2.4" fill="#151b24"/><rect x="5" y="36" width="50" height="3.4" fill="#e1e1e1"/>${[39.4,46.2].map(y=>`<rect x="5" y="${y}" width="50" height="3.4" fill="#fff"/>`).join("")}${[42.8,49.6].map(y=>`<rect x="5" y="${y}" width="50" height="3.4" fill="#f0f0f0"/>`).join("")}<rect x="5" y="55" width="50" height="3" fill="#ececec"/><rect x="5" y="61" width="50" height="3" fill="#ececec"/><rect x="44" y="61.8" width="10" height="1.4" fill="#151b24"/>`,
      minimal:`<rect x="6" y="6" width="10" height="3" fill="#0c2340"/><rect x="6" y="16" width="14" height="1.5" fill="#9aa2ad"/><rect x="6" y="19" width="26" height="6" fill="#151b24"/><rect x="40" y="16" width="14" height="8" fill="#e8ebef"/><rect x="6" y="29" width="48" height=".5" fill="#d5d9df"/>${[38,42,46,50].map(y=>`<rect x="6" y="${y}" width="48" height=".5" fill="#e3e6ea"/>`).join("")}<rect x="38" y="57" width="16" height="2.5" fill="#151b24"/>`,
      block:`<rect width="60" height="17" fill="${a}"/><rect x="5" y="4" width="17" height="8" rx="1.5" fill="#fff"/><rect x="8" y="6.5" width="11" height="3" fill="#0c2340"/><rect x="38" y="5" width="17" height="3" fill="#fff"/><rect x="44" y="10" width="11" height="2" fill="#fff" opacity=".8"/><rect x="5" y="23" width="18" height="2" fill="#9aa2ad"/><rect x="5" y="34" width="50" height="4" fill="#f4e3e3"/>${[41,45,49].map(y=>`<rect x="5" y="${y}" width="50" height=".7" fill="#d5d9df"/>`).join("")}<rect x="34" y="56" width="21" height="5" rx="1" fill="${a}"/>`,
      side:`<rect width="18" height="80" fill="#eef3f8"/><rect x="3" y="5" width="12" height="5" rx="1" fill="#fff"/><rect x="5" y="6.5" width="8" height="2" fill="#0c2340"/>${[16,19,22,30,33,41,44].map(y=>`<rect x="3" y="${y}" width="11" height="1.2" fill="#9aa2ad"/>`).join("")}<rect x="23" y="7" width="16" height="2" fill="#9aa2ad"/><rect x="23" y="18" width="14" height="3" fill="#0c2340"/><rect x="23" y="22.5" width="10" height="1.6" fill="${a}"/><rect x="23" y="30" width="32" height="1" fill="#0c2340"/>${[34,38,42].map(y=>`<rect x="23" y="${y}" width="32" height=".6" fill="#d5d9df"/>`).join("")}<rect x="40" y="50" width="15" height="2.5" fill="${a}"/>`,
      werkstatt:`<rect width="60" height="2" fill="${a}"/><rect x="5" y="6" width="16" height="4" fill="#0c2340"/><rect x="5" y="16" width="18" height="2" fill="#9aa2ad"/><rect x="5" y="25" width="50" height="10" rx="1" fill="#f6f7f9" stroke="#d5d9df" stroke-width=".4"/><rect x="5" y="25" width="1.2" height="10" fill="${a}"/><rect x="8" y="27.5" width="10" height="1.5" fill="#9aa2ad"/><rect x="24" y="27.5" width="12" height="1.5" fill="#9aa2ad"/><rect x="40" y="27.5" width="9" height="1.5" fill="#9aa2ad"/><rect x="8" y="30.5" width="12" height="2" fill="#151b24"/><rect x="24" y="30.5" width="14" height="2" fill="#151b24"/><rect x="5" y="39" width="50" height="3" fill="#eef3f8"/>${[44,47].map(y=>`<rect x="5" y="${y}" width="50" height=".6" fill="#d5d9df"/>`).join("")}<rect x="5" y="51" width="50" height="3" fill="#eef3f8"/><rect x="5" y="56" width="50" height=".6" fill="#d5d9df"/><rect x="38" y="62" width="17" height="3" fill="${a}"/>`,
      kompakt:`<rect x="5" y="4" width="14" height="4" fill="#0c2340"/><rect x="5" y="13" width="16" height="2" fill="#9aa2ad"/><rect x="5" y="22" width="50" height="1.4" fill="#0c2340"/>${[26,29,32,35,38,41,44,47].map(y=>`<rect x="5" y="${y}" width="50" height=".8" fill="#d5d9df"/>`).join("")}<rect x="38" y="52" width="17" height="3" fill="${a}"/>`
    };
    return `<svg viewBox="0 0 60 80" aria-hidden="true"><rect width="60" height="80" fill="#fff"/>${L[k]}</svg>`;
  }

  function vMehr(){
    const f=S.firma; const filled=["name","strasse","plz","ort","iban"].filter(k=>f[k]).length;
    const teile=UI.selVis.teile=[...S.teile].sort((a,b)=>(a.bez||"").localeCompare(b.bez||"","de"));
    const theme=getTheme(), akz=ACCENTS[f.akzent]?f.akzent:"repair", lay=pdfLayout();
    const texteSet=["textRechnung","textAngebot","haftung"].filter(k=>(f[k]||"").trim()).length;
    const invs=S.rechnungen.filter(r=>dTyp(r)==="rechnung" && r.nr && dStatus(r)!=="entwurf");
    const years=[...new Set([String(new Date().getFullYear()), ...invs.map(r=>(r.datum||"").slice(0,4)).filter(Boolean), ...S.ausgaben.map(x=>(x.datum||"").slice(0,4)).filter(Boolean)])].sort().reverse();
    const csvCount=csvRows().length, ausCount=ausRowsFor(UI.csvYear + (UI.csvMonth ? "-"+UI.csvMonth : "")).length;
    return `${accountGroup()}<div class="group"><span class="glabel">Firma &amp; Rechnung</span>
      <button class="card" data-act="firma"><div class="row"><h3>Firmendaten, Bank, Logo</h3><span class="pill ${filled===5?"s-bezahlt":"s-versendet"}">${filled===5?"Vollständig":filled+" von 5"}</span></div>
      <div class="meta">${f.name?esc(f.name)+(f.ort?" · "+esc(f.ort):""):"Erscheinen im Kopf und Fuß jeder Rechnung."}</div>
      <div class="meta">${f.kleinunternehmer?"Kleinunternehmer (§ 19 UStG) – ohne MwSt":(f.netto?"Preise netto, zzgl. 19 % MwSt":"Preise inkl. 19 % MwSt")} · Zahlungsziel ${f.ziel??14} Tage${f.geminiApiKey?" · KI-Belegerkennung an":""}</div></button></div>

      <div class="group" id="grpTexte"><span class="glabel">Textbausteine &amp; Hinweise</span>
      <button class="card" data-act="texte"><div class="row"><h4>${ico.text}Standardtexte für Belege</h4><span class="pill ${texteSet?"s-bezahlt":"s-entwurf"}">${texteSet} von 3</span></div>
      <div class="meta">Garantie-Hinweis für Rechnungen, Hinweis für Angebote &amp; KVA, Haftungsausschluss auf jedem Beleg.</div></button></div>

      <div class="group" id="grpDesign"><span class="glabel">Design &amp; Layout</span>
      <div class="card" style="gap:14px">
        <div class="setrow"><span class="lbl">Erscheinungsbild der App</span>
          <div class="seg">${[["light","Hell"],["dark","Dunkel"],["system","System"]].map(([k,l])=>`<button data-themeset="${k}" aria-pressed="${theme===k}">${l}</button>`).join("")}</div></div>
        <div class="setrow"><span class="lbl">Akzentfarbe (Aktions-Buttons &amp; Belege)</span>
          <div class="swatches">${Object.entries(ACCENTS).map(([k,a])=>`<button class="sw" data-akzent="${k}" aria-pressed="${akz===k}"><i style="background:${a.c}"></i>${a.l}</button>`).join("")}</div></div>
        <div class="setrow"><span class="lbl">PDF-Design für Rechnungen &amp; Angebote</span>
          <div class="layouts">${Object.entries(LAYOUTS).map(([k,l])=>`<button class="lay" data-pdflayout="${k}" aria-pressed="${lay===k}">${layThumb(k)}<b>${l.l}</b><small>${l.d}</small></button>`).join("")}</div>
          <button class="linkbtn" data-act="pdfsample">${ico.preview} Beispiel-Blatt ansehen</button></div>
        <div class="lineform"><span><b style="font-weight:600">„BEZAHLT“-Stempel</b><br><small style="color:var(--muted)">Dezent auf bezahlten Rechnungen und im PDF</small></span><input type="checkbox" class="toggle" id="setStempel" ${f.stempel?"checked":""}></div>
      </div></div>

      <div class="group" id="grpTeile"><span class="glabel">Produkte, Ersatzteile &amp; Leistungen</span>
      ${ioBar("teile", S.teile.length, "Produkt", "Produkte")}
      ${teile.length? `<div class="box">${teile.map(t=>`<button class="kv${isPicked("teile",t.id)?" picked":""}" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left" ${UI.sel?.kind==="teile"?`data-pick="${t.id}"`:`data-teil="${t.id}"`}><span style="color:var(--fg);font-weight:600;display:flex;align-items:center;gap:10px;min-width:0">${UI.sel?.kind==="teile"?pickCircle():""}<span style="min-width:0">${t.artnr?`<span class="mono" style="color:var(--faint);margin-right:6px">${esc(t.artnr)}</span>`:""}${esc(t.bez)}${t.kategorie==="Dienstleistung"?` <span class="tag">Leistung</span>`:""}</span></span><span class="num">${eur(t.preis)}${t.kategorie==="Dienstleistung"?"":` · <span style="color:${(+t.bestand||0)<=1?"var(--red)":"var(--muted)"}">${+t.bestand||0} ${esc(t.einheit||"Stk.")}</span>`}</span></button>`).join("")}</div>${selBar("teile")}`
        : `<div class="card"><span style="color:var(--muted)">Legen Sie häufige Teile an (Display, Akku, Ladebuchse). Beim Auftrag und in der Rechnung wählen Sie sie dann mit einem Tipp aus, und der Bestand zählt mit.</span></div>`}
      <div class="btnrow"><button class="btn ghost" data-act="newteil">+ Produkt anlegen</button>${teile.length?"":`<button class="btn ghost" data-act="importTeile">${ico.upl} Produkte importieren</button>`}</div></div>

      <div class="group" id="grpBackup"><span class="glabel">Datensicherung &amp; Backup</span>
        <div class="card"><span style="color:var(--muted)">Sichert Firmendaten, Kunden, Aufträge, Rechnungen, Angebote, Ersatzteile und Ausgaben samt Belegfotos in einer Datei. Am besten regelmäßig herunterladen und z. B. in iCloud Drive ablegen.</span>
          <div class="btnrow"><button class="btn" data-act="backupExport">${ico.dl}Backup herunterladen</button><button class="btn ghost" data-act="backupImport">Backup wiederherstellen</button></div>
          <input type="file" id="backupFile" accept="application/json,.json" hidden>
          ${UI.pendingImport?`<div class="confirm"><span><b>Backup vom ${esc(deStamp(UI.pendingImport.exportiert)||"unbekannten Datum")} wiederherstellen?</b><br>${UI.pendingImport.kunden.length} Kunden, ${UI.pendingImport.auftraege.length} Aufträge, ${UI.pendingImport.rechnungen.length} Rechnungen/Angebote, ${UI.pendingImport.teile.length} Ersatzteile, ${UI.pendingImport.ausgaben.length} Ausgaben. Ihre aktuellen Daten werden dabei vollständig ersetzt.</span>
            <div class="btnrow"><button class="btn danger" data-act="backupApply">Ja, wiederherstellen</button><button class="btn ghost" data-act="backupCancel">Abbrechen</button></div></div>`:""}
        </div>
        <div class="card"><h4>${ico.table}Buchhaltung (CSV-Export)</h4>
          <span style="color:var(--muted)">Rechnungen und Ausgaben eines Zeitraums als Tabellen für den Steuerberater. Öffnet sich in Excel, Numbers und DATEV-Importen.</span>
          <div class="csvrow"><select id="csvYear" class="input" aria-label="Jahr">${years.map(y=>`<option ${UI.csvYear===y?"selected":""}>${y}</option>`).join("")}</select>
            <select id="csvMonth" class="input" aria-label="Monat"><option value="">Ganzes Jahr</option>${MONTHS.map((n,i)=>`<option value="${pad(i+1)}" ${UI.csvMonth===pad(i+1)?"selected":""}>${n}</option>`).join("")}</select></div>
          <div class="exrow"><span><b>Rechnungen</b><small>${csvCount} im Zeitraum · Netto, MwSt., Brutto</small></span><button class="btn sm" data-act="csvExport" ${csvCount?"":"disabled"}>${ico.dl}CSV</button></div>
          <div class="exrow"><span><b>Ausgaben</b><small>${ausCount} im Zeitraum · Netto, Vorsteuer, Brutto</small></span><button class="btn sm" data-act="csvAus" ${ausCount?"":"disabled"}>${ico.dl}CSV</button></div>
          <div class="exrow"><span><b>Komplettpaket (ZIP)</b><small>Beide Tabellen plus alle Belegfotos und PDFs</small></span><button class="btn sm accent" data-act="paket" ${csvCount||ausCount?"":"disabled"}>${ico.dl}ZIP</button></div>
        </div></div>
      <p class="syncnote">${mode==="db"?"Gespeichert in Ihrem Konto – privat, auf allen Geräten gleich.":"Gespeichert in diesem Browser."}<br><small style="opacity:.7">WerkDoc · App-Stand ${APP_VER}</small></p>`;
  }

  /* ---------- view bindings ---------- */
  function bindView(){
    const m=$("#main");
    // Langes Drücken auf einen Kalendertag → Aktionen für diesen Tag
    m.onpointerdown = e => {
      if(LP?.fired) LP=null;   // neuer Tipp: vorheriges Long-Press ist erledigt
      const d=e.target.closest(".day"); if(!d || (e.pointerType==="mouse" && e.button!==0)) return;
      clearTimeout(LP?.t); d.classList.add("pressing");
      LP={ d, x:e.clientX, y:e.clientY, fired:false, t:setTimeout(()=>{ LP.fired=true; d.classList.remove("pressing"); d.classList.add("lp-done"); setTimeout(()=>d.classList.remove("lp-done"),340);
        try{ navigator.vibrate?.(40); }catch(_){} dayMenu(d.dataset.day); setTimeout(()=>{ if(LP?.fired) LP=null; }, 900); }, 500) };
    };
    const lpCancel=()=>{ if(LP && !LP.fired){ clearTimeout(LP.t); LP.d.classList.remove("pressing"); LP=null; } };
    m.onpointermove = e => { if(LP && !LP.fired && Math.hypot(e.clientX-LP.x, e.clientY-LP.y)>10) lpCancel(); };
    m.onpointerup = lpCancel; m.onpointercancel = lpCancel;
    m.oncontextmenu = e => { const d=e.target.closest(".day"); if(!d) return; e.preventDefault(); if(!LP?.fired && $("#picker").hidden){ lpCancel(); dayMenu(d.dataset.day); } };
    m.onclick = e => {
      if(LP?.fired){ LP=null; e.preventDefault(); return; }
      const t=e.target.closest("button"); if(!t) return;
      if(t.dataset.hint){ hidden[t.dataset.hint]=1; try{localStorage.setItem("rm-hints",JSON.stringify(hidden));}catch(e){} render(); return; }
      if(t.dataset.f){ UI.filter=t.dataset.f; render(); return; }
      if(t.dataset.df){ UI.docFilter=t.dataset.df; render(); return; }
      if(t.dataset.seg){ UI.docSeg=t.dataset.seg; UI.docFilter="alle"; if(UI.sel?.kind==="rechnungen") UI.sel=null; render(); return; }
      if(t.dataset.themeset){ setTheme(t.dataset.themeset); toast({light:"Helles Design",dark:"Dunkles Design",system:"Design folgt dem System"}[t.dataset.themeset]); return; }
      if(t.dataset.akzent){ setFirma({akzent:t.dataset.akzent}); toast(`Akzentfarbe: ${ACCENTS[t.dataset.akzent].l}`); return; }
      if(t.dataset.pdflayout){ setFirma({pdfLayout:t.dataset.pdflayout}); toast(`PDF-Design: ${LAYOUTS[t.dataset.pdflayout].l}`); return; }
      if(t.dataset.pick && UI.sel){ const id=t.dataset.pick; UI.sel.ids.has(id) ? UI.sel.ids.delete(id) : UI.sel.ids.add(id); UI.sel.confirm=false; render(); return; }
      if(t.dataset.job) return openJobDetail(t.dataset.job);
      if(t.dataset.doc) return openDoc(t.dataset.doc);
      if(t.dataset.aus) return openAusgabe(t.dataset.aus);
      if(t.dataset.am!=null){ const d=+t.dataset.am; if(d===0) UI.ausMonth=today().slice(0,7); else { const [y,mo]=UI.ausMonth.split("-").map(Number); const n=new Date(y,mo-1+d,1); UI.ausMonth=`${n.getFullYear()}-${pad(n.getMonth()+1)}`; } render(); return; }
      if(t.dataset.kunde) return openKunde(t.dataset.kunde);
      if(t.dataset.teil) return openTeil(t.dataset.teil);
      if(t.dataset.day){ UI.calDay=t.dataset.day; render(); return; }
      if(t.dataset.m!=null){ const d=+t.dataset.m; if(d===0){ UI.calMonth=today().slice(0,7); UI.calDay=today(); } else { const [y,mo]=UI.calMonth.split("-").map(Number); const n=new Date(y,mo-1+d,1); UI.calMonth=`${n.getFullYear()}-${pad(n.getMonth()+1)}`; } render(); return; }
      const a=t.dataset.act;
      if(a==="newjob") openAuftrag(); if(a==="newjobday") openAuftrag(null, UI.calDay);
      if(a==="examples") loadExamples(); if(a==="newdoc") openDocEditor({typ:UI.docSeg==="angebote"?"angebot":"rechnung"});
      if(a==="newkunde") openKunde(); if(a==="firma") openFirma(); if(a==="newteil") openTeil();
      if(a==="texte") openTexte();
      if(a==="selStart"){ UI.sel={kind:t.dataset.kind, ids:new Set(), confirm:false}; render(); return; }
      if(a==="selDone"){ UI.sel=null; render(); return; }
      if(a==="selAll" && UI.sel){ const vis=UI.selVis[UI.sel.kind].map(x=>x.id); const all=vis.length && vis.every(id=>UI.sel.ids.has(id)); UI.sel.ids = all ? new Set() : new Set(vis); UI.sel.confirm=false; render(); return; }
      if(a==="selDel" && UI.sel?.ids.size){ UI.sel.confirm=true; render(); return; }
      if(a==="selNo" && UI.sel){ UI.sel.confirm=false; render(); return; }
      if(a==="selYes" && UI.sel){ const {kind, ids}=UI.sel; const n=ids.size; UI.sel=null; removeMany(kind,[...ids]); toast(`${n} ${selWord(kind,n)} gelöscht`); return; }
      if(a==="selStorno" && UI.sel){ const ids=UI.sel.ids; UI.sel=null; const list=S.rechnungen.filter(r=>ids.has(r.id) && dTyp(r)==="rechnung" && r.nr && !["entwurf","storniert"].includes(dStatus(r)));
        const upd=list.map(r=>({...r, status:"storniert", verlauf:[...(r.verlauf||[]), {t:nowStamp(), e:"Status: Storniert"}]})); delete upd.bezahlt;
        upd.forEach(o=>upsertLocal("rechnungen",o)); lsSave(); render();
        if(mode==="db") (async()=>{ for(const o of upd){ const {id,...b}=o; try{ await dbRefs.rechnungen.doc(id).set(b); }catch(e){ toast("Stornieren teilweise nicht gespeichert"); break; } } })();
        toast(`${upd.length} Rechnung${upd.length===1?"":"en"} storniert`); return; }
      if(a==="importKunden") pickCsv("kunden"); if(a==="importTeile") pickCsv("teile");
      if(a==="importDocs") pickCsv("rechnungen"); if(a==="exportDocs") exportDocsMenu();
      if(a==="exportKunden") exportMenu("kunden"); if(a==="exportTeile") exportMenu("teile");
      if(a==="pdfsample") openViewer(sampleDoc(), `<b>Beispiel-Blatt · ${LAYOUTS[pdfLayout()].l}</b><span>So sehen Ihre Belege mit den aktuellen Einstellungen aus.</span>`);
      if(a==="csvExport") exportCsv();
      if(a==="logout"){ logout(); return; } if(a==="logoutYes"){ logoutNow(); return; } if(a==="logoutNo"){ LOGOUT_ASK=null; render(); return; }
      if(a==="syncNow"){ cloudSyncNow().then(()=>toast(CLOUD.status==="err"?CLOUD.msg:"Synchronisiert")); return; }
      if(a==="login"){ CLOUD.skip=false; showAuth("login"); return; }
      if(a==="newAus") newAusgabe(); if(a==="multiAus") pickMulti(); if(a==="ausExport") ausExportMenu();
      if(a==="csvAus") exportAusCsv(UI.csvYear + (UI.csvMonth ? "-"+UI.csvMonth : ""));
      if(a==="paket") exportPaket(UI.csvYear + (UI.csvMonth ? "-"+UI.csvMonth : ""), true);
      if(a==="backupExport") exportBackup();
      if(a==="backupImport") $("#backupFile").click();
      if(a==="backupApply") applyBackup(UI.pendingImport);
      if(a==="backupCancel"){ UI.pendingImport=null; render(); }
    };
    fillThumbs(m);
    const q=$("#q"); if(q) q.oninput = () => { UI.q=q.value; render(); };
    const bf=$("#backupFile"); if(bf) bf.onchange = importBackup;
    const st=$("#setStempel"); if(st) st.onchange = () => { setFirma({stempel:st.checked}); toast(st.checked?"„BEZAHLT“-Stempel an":"„BEZAHLT“-Stempel aus"); };
    const cy=$("#csvYear"); if(cy) cy.onchange = () => { UI.csvYear=cy.value; render(); };
    const cm=$("#csvMonth"); if(cm) cm.onchange = () => { UI.csvMonth=cm.value; render(); };
  }

  /* ---------- sheet ---------- */
  let sheetSave=null, sheetRight=null;
  function openSheet(title, body, onSave, saveLabel="Speichern", opts={}){
    $("#sTitle").innerHTML=title; $("#sBody").innerHTML=body; $("#sBody").scrollTop=0;
    const sb=$("#sSave"); sheetSave=onSave; sheetRight=opts.onRight||null;
    if(opts.onRight){ sb.hidden=false; sb.className="hbtn icon"; sb.innerHTML=opts.rightIcon; sb.setAttribute("aria-label",opts.rightLabel||""); }
    else { sb.className="hbtn go"; sb.textContent=saveLabel; sb.removeAttribute("aria-label"); sb.hidden=!onSave; }
    $("#sCancel").textContent = opts.cancelLabel || (onSave||opts.onRight ? "Abbrechen" : "Schließen");
    const f=$("#sFoot"); if(opts.foot){ f.innerHTML=opts.foot; f.hidden=false; } else { f.innerHTML=""; f.hidden=true; }
    $("#scrim").hidden=false; $("#sheet").hidden=false;
    requestAnimationFrame(()=>{ $("#scrim").classList.add("on"); $("#sheet").classList.add("on"); fitPapers(); });
  }
  function closeSheet(){
    $("#scrim").classList.remove("on"); $("#sheet").classList.remove("on");
    setTimeout(()=>{ $("#scrim").hidden=true; $("#sheet").hidden=true; $("#sBody").innerHTML=""; $("#sFoot").innerHTML=""; }, 230);
  }
  $("#sCancel").onclick=closeSheet; $("#scrim").onclick=closeSheet;
  document.addEventListener("keydown", e=>{ if(e.key!=="Escape") return; if(!$("#viewer").hidden) return closeViewer(); if(!$("#picker").hidden) return closePicker(); if(!$("#sheet").hidden) closeSheet(); });
  $("#sSave").onclick=()=>{ if(sheetRight) return sheetRight(); if(sheetSave && sheetSave()!==false) closeSheet(); };
  const val = id => ($("#"+id)?.value ?? "").trim();

  function openPicker(title, opts, onPick){
    const p=$("#picker");
    p.innerHTML=`<h3>${esc(title)}</h3>${opts.map((o,i)=>`<button class="opt" data-i="${i}"><span>${esc(o.label)}${o.sub?`<small>${esc(o.sub)}</small>`:""}</span>${o.pill?`<span class="pill s-${o.pill}">${DST[o.pill]||""}</span>`:""}</button>`).join("")}<button class="btn ghost wide" id="pkClose">Abbrechen</button>`;
    $("#pscrim").hidden=false; p.hidden=false; PK_OPEN=Date.now();
    p.onclick=e=>{ if(Date.now()-PK_OPEN<450) return; const b=e.target.closest("[data-i]"); if(b){ closePicker(); onPick(opts[+b.dataset.i]); } else if(e.target.closest("#pkClose")) closePicker(); };
  }
  function closePicker(){ $("#picker").hidden=true; $("#pscrim").hidden=true; }
  let PK_OPEN=0;
  $("#pscrim").onclick=()=>{ if(Date.now()-PK_OPEN<450) return; closePicker(); };

  function paperBox(r){ return `<div class="pscale" data-zoomdoc><div class="pinner">${paperHtml(r)}</div></div>`; }
  function fitPapers(root=document){
    $$(".pscale", root).forEach(el=>{ const inner=$(".pinner",el); const pe=el.parentElement, cs=getComputedStyle(pe); const w=pe.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight); const s=Math.min(w/794, 2.5)*(+el.dataset.z||1);
      el.style.width=(794*s)+"px"; inner.style.transform=`scale(${s})`; el.style.height=(inner.offsetHeight*s)+"px"; });
  }
  window.addEventListener("resize", ()=>fitPapers());
  function openViewer(r, note){
    $("#vTitle").textContent = TYP[dTyp(r)].l;
    const n=$("#vNote"); if(note){ n.innerHTML=note; n.hidden=false; } else n.hidden=true;
    $("#vBody").innerHTML = paperBox(r); $("#viewer").hidden=false;
    const imgs=$$("#vBody img"); fitPapers($("#viewer")); imgs.forEach(i=>i.complete||i.addEventListener("load",()=>fitPapers($("#viewer")),{once:true}));
  }
  function closeViewer(){ $("#viewer").hidden=true; $("#vBody").innerHTML=""; }
  function zoomViewer(dir){ const el=$("#vBody .pscale"); if(!el) return; let z=+el.dataset.z||1; z=Math.max(1,Math.min(3, z+(dir>0?.5:-.5))); el.dataset.z=z; fitPapers($("#viewer")); }
  $("#vClose").onclick=closeViewer; $("#vIn").onclick=()=>zoomViewer(1); $("#vOut").onclick=()=>zoomViewer(-1);

  /* ---------- position editor (shared) ---------- */
  function einhOpts(sel){ const s=sel||"Stk."; const list=EINH.some(e=>e[0]===s)?EINH:[...EINH,[s,s]]; return list.map(([k,l])=>`<option value="${esc(k)}" ${k===s?"selected":""}>${esc(l)} (${esc(k)})</option>`).join(""); }
  function posRow(p={}){
    return `<div class="pcard" ${p.teilId?`data-teil="${p.teilId}"`:""}>
      <div class="prow1"><input class="pt" placeholder="Titel der Position" value="${esc(p.bez)}" aria-label="Titel der Position"><button class="x" type="button" aria-label="Position entfernen">×</button></div>
      <div class="prow2"><label>Menge<input class="pm r" inputmode="decimal" value="${numIn(p.menge??1)}"></label><label>Einheit<select class="pe">${einhOpts(p.einheit)}</select></label><label>Preis €<input class="pp r" inputmode="decimal" placeholder="0,00" value="${numIn(p.preis)}"></label></div>
      <div class="ptot">${eur((+p.menge||0)*(+p.preis||0))}</div></div>`;
  }
  function posSection(pos, title="Positionen"){
    const opts = S.teile.map(t=>`<option value="${t.id}">${esc(t.bez)} – ${eur(t.preis)}</option>`).join("");
    return `<div class="sec"><h4>${ico.list}<span class="sp">${title}</span><button type="button" class="btn sm" id="addPos" aria-label="Position hinzufügen">${ico.plus}</button></h4>
      <div class="ptools"><button type="button" class="btn ghost sm" id="addLabor">+ Arbeitszeit</button>${S.teile.length?`<select id="addTeil" class="btn ghost sm" aria-label="Ersatzteil hinzufügen"><option value="">+ Ersatzteil…</option>${opts}</select>`:""}</div>
      <div id="posRows" style="display:flex;flex-direction:column;gap:10px">${(pos||[]).map(posRow).join("")}</div>
      <div class="lineform" style="border-top:1px solid var(--line);padding-top:10px"><span class="lbl">Positionen gesamt</span><strong class="num" id="posSum">${eur(sumPos(pos))}</strong></div></div>`;
  }
  function bindPos(onChange=()=>{}){
    const rows=$("#posRows");
    const upd=()=>{ $$(".pcard",rows).forEach(c=>{ $(".ptot",c).textContent=eur(parseNum($(".pm",c).value)*parseNum($(".pp",c).value)); }); $("#posSum").textContent=eur(sumPos(readPos())); onChange(); };
    const add=p=>{ rows.insertAdjacentHTML("beforeend",posRow(p)); upd(); };
    $("#addPos").onclick=()=>{ add({menge:1,einheit:"Stk."}); rows.lastElementChild.querySelector(".pt").focus(); };
    $("#addLabor").onclick=()=>add({bez:"Arbeitszeit / Reparatur", menge:1, einheit:"psch.", preis:S.firma.pauschale??39});
    const at=$("#addTeil"); if(at) at.onchange=()=>{ const t=S.teile.find(x=>x.id===at.value); if(t) add({bez:t.bez+(t.artnr?` (${t.artnr})`:""), menge:1, einheit:t.einheit||"Stk.", preis:t.preis, teilId:t.id}); at.value=""; };
    rows.oninput=upd; rows.onchange=upd;
    rows.onclick=e=>{ if(e.target.classList.contains("x")){ e.target.closest(".pcard").remove(); upd(); } };
  }
  function readPos(){ return $$("#posRows .pcard").map(r=>({bez:$(".pt",r).value.trim(), menge:parseNum($(".pm",r).value), einheit:$(".pe",r).value, preis:parseNum($(".pp",r).value), ...(r.dataset.teil?{teilId:r.dataset.teil}:{})})).filter(p=>p.bez||p.preis); }

  function kundeSelect(sel, idp){
    const kOpts = [...S.kunden].sort((x,y)=>x.name.localeCompare(y.name,"de")).map(k=>`<option value="${k.id}" ${sel===k.id?"selected":""}>${esc(k.name)}</option>`).join("");
    return `<select id="${idp}Kunde" class="input"><option value="">Bitte wählen</option>${kOpts}</select>
      <button type="button" class="linkbtn" id="${idp}NewK"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="var(--link)"/><path d="M12 7v10M7 12h10" stroke="var(--surface)" stroke-width="2.2" stroke-linecap="round"/></svg>Neuen Kunden anlegen</button>
      <div id="${idp}NewKBox" hidden style="display:flex;flex-direction:column;gap:8px"><input class="input" id="${idp}KName" placeholder="Vor- und Nachname"><input class="input" id="${idp}KTel" inputmode="tel" placeholder="Telefon (optional)"></div>`;
  }
  function bindKundeSelect(idp){
    $(`#${idp}NewK`).onclick=()=>{ const b=$(`#${idp}NewKBox`); b.hidden=!b.hidden; if(!b.hidden){ $(`#${idp}Kunde`).value=""; $(`#${idp}KName`).focus(); } };
  }
  function readKunde(idp){
    const box=$(`#${idp}NewKBox`);
    if(box && !box.hidden){ const n=val(idp+"KName"); if(!n) return {err:"Bitte den Kundennamen eintragen"}; const k={id:uid(),nr:nextKundenNr(),name:n,tel:val(idp+"KTel"),created:today()}; return {neu:k, id:k.id}; }
    return {id:val(idp+"Kunde")};
  }

  /* ---------- Auftrag form ---------- */
  function openAuftrag(id, presetDay){
    const a = id ? S.auftraege.find(x=>x.id===id) : null;
    const t = a?.termin || ((presetDay||today())+"T10:00");
    openSheet(a?`Auftrag <small>#${esc(a.nr)}</small>`:"Neuer Auftrag", `
      <div class="group"><span class="glabel">Gerät</span><div class="box">
        <div class="field stack"><label for="fGeraet">Gerät &amp; Reparatur</label><input id="fGeraet" placeholder="z. B. iPhone 13 Pro – Display" value="${esc(a?.geraet)}"></div>
        <div class="field stack"><label for="fProblem">Fehlerbeschreibung</label><textarea id="fProblem" placeholder="Was ist kaputt? Zustand bei Annahme?">${esc(a?.problem)}</textarea></div>
        <div class="field"><label for="fImei">IMEI / Seriennr.</label><input id="fImei" class="mono" placeholder="optional" value="${esc(a?.imei)}"></div>
        <div class="field"><label for="fZubehoer">Zubehör</label><input id="fZubehoer" placeholder="z. B. Hülle, Ladekabel" value="${esc(a?.zubehoer)}"></div>
      </div></div>
      <div class="sec"><h4>${ico.card}Kunde</h4>${kundeSelect(a?.kundeId,"a")}</div>
      <div class="group"><span class="glabel">Termin &amp; Status</span><div class="box">
        <div class="field"><label for="fDate">Termin</label><input id="fDate" type="date" value="${t.slice(0,10)}"></div>
        <div class="field"><label for="fTime">Uhrzeit</label><input id="fTime" type="time" value="${t.length>10?t.slice(11,16):""}"></div>
        <div class="field"><label for="fErl">Repariert am</label><input id="fErl" type="date" value="${esc(a?.erledigt||"")}"></div>
        <div class="field"><label for="fStatus">Status</label><select id="fStatus">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${(a?.status||"angenommen")===k?"selected":""}>${v.l}</option>`).join("")}</select></div>
      </div><p class="help">„Repariert am“ erscheint grün im Kalender.</p></div>
      ${posSection(a?.positionen, "Positionen (Teile & Arbeit)")}
      ${a?`<button class="btn danger" id="delJob">Auftrag löschen</button><div id="delConfirm"></div>`:""}
    `, () => {
      const geraet=val("fGeraet"); if(!geraet){ toast("Bitte das Gerät eintragen"); $("#fGeraet").focus(); return false; }
      const k=readKunde("a"); if(k.err){ toast(k.err); return false; } if(k.neu) save("kunden",k.neu);
      const d=val("fDate"), tm=val("fTime");
      let status=val("fStatus"), erledigt=val("fErl");
      if(erledigt && STATUS[status].n<3) status="fertig";
      const obj={...(a||{id:uid(),nr:nextJobNr(),created:today()}), geraet, problem:val("fProblem"), imei:val("fImei"), zubehoer:val("fZubehoer"), kundeId:k.id, termin:d?(tm?`${d}T${tm}`:d):"", erledigt, status, positionen:readPos()};
      if(status==="abgeholt" && !obj.abgeholtAm) obj.abgeholtAm=today();
      save("auftraege",obj); toast(a?"Auftrag gespeichert":`Auftrag #${obj.nr} angelegt`);
      if(d){ UI.calMonth=d.slice(0,7); UI.calDay=d; }
    });
    bindPos(); bindKundeSelect("a");
    if(!S.kunden.length && !a){ $("#aNewKBox").hidden=false; }
    const dj=$("#delJob"); if(dj) dj.onclick=()=>confirmBox(`Auftrag #${esc(a.nr)} endgültig löschen? Rechnungen bleiben erhalten.`, ()=>{ remove("auftraege",a.id); closeSheet(); toast("Auftrag gelöscht"); });
  }
  function confirmBox(text, yes){
    const c=$("#delConfirm"); c.innerHTML=`<div class="confirm"><span>${text}</span><div class="btnrow"><button class="btn danger" id="delYes">Ja, löschen</button><button class="btn ghost" id="delNo">Behalten</button></div></div>`;
    $("#delYes").onclick=yes; $("#delNo").onclick=()=>{ c.innerHTML=""; }; c.scrollIntoView({block:"nearest",behavior:"smooth"});
  }

  /* ---------- Auftrag detail ---------- */
  function openJobDetail(id){
    const a=S.auftraege.find(x=>x.id===id); if(!a) return; pushRecent("job",id);
    const k=kunde(a.kundeId); const docs=S.rechnungen.filter(r=>r.auftragId===a.id);
    openSheet(`Auftrag <small>#${esc(a.nr)}</small>`, `
      <div><span class="pill s-${a.status}">${STATUS[a.status].l}</span><h2 style="font-family:var(--f-display);font-size:26px;margin:8px 0 2px;text-wrap:balance">${esc(a.geraet)}</h2>
      <div class="meta"><span>${ico.user}${esc(k?.name||"Ohne Kunde")}</span>${k?.tel?`<span>${ico.phone}<span style="user-select:all">${esc(k.tel)}</span></span>`:""}</div></div>
      <div class="group"><span class="glabel">Status ändern</span><div class="steps">${Object.entries(STATUS).map(([s,v])=>`<button class="step a${v.n}" data-st="${s}" aria-pressed="${a.status===s}">${v.l}</button>`).join("")}</div>
      ${a.status!=="fertig"&&a.status!=="abgeholt"?`<button class="btn accent" id="doneToday">${ico.check} Heute repariert</button>`:""}</div>
      <div class="box">
        <div class="kv"><span>Termin</span><span>${a.termin?deDate(a.termin)+(a.termin.length>10?", "+a.termin.slice(11,16)+" Uhr":""):"—"}</span></div>
        <div class="kv"><span>Repariert am</span><span>${a.erledigt?deDate(a.erledigt):"—"}</span></div>
        ${a.abgeholtAm?`<div class="kv"><span>Abgeholt am</span><span>${deDate(a.abgeholtAm)}</span></div>`:""}
        ${a.imei?`<div class="kv"><span>IMEI / Seriennr.</span><span class="mono">${esc(a.imei)}</span></div>`:""}
        ${a.zubehoer?`<div class="kv"><span>Zubehör</span><span>${esc(a.zubehoer)}</span></div>`:""}
        ${a.problem?`<div class="kv" style="flex-direction:column;gap:4px"><span>Fehler</span><span style="text-align:left;font-weight:500">${esc(a.problem)}</span></div>`:""}
      </div>
      <div class="group"><span class="glabel">Positionen</span><div class="box">
        ${(a.positionen||[]).map(p=>`<div class="kv"><span style="color:var(--fg)">${numIn(p.menge)} ${esc(p.einheit||"Stk.")} · ${esc(p.bez)}</span><span class="num">${eur(p.menge*p.preis)}</span></div>`).join("") || `<div class="kv"><span>Noch keine Positionen</span><span></span></div>`}
        <div class="total"><span>Summe</span><span class="num">${eur(sumPos(a.positionen))}</span></div></div></div>
      ${docs.length?`<div class="group"><span class="glabel">Dokumente zu diesem Auftrag</span>${docs.map(docCard).join("")}</div>`:""}
      ${jobAusHtml(a)}
      ${msgButtons(a,k)}
      <div class="btnrow">
        <button class="btn" id="mkInv">${ico.doc} Rechnung erstellen</button>
        <button class="btn ghost" id="mkKva">Kostenvoranschlag</button>
        <button class="btn ghost" id="editJob">Bearbeiten</button>
      </div>`, null);
    $$(".step").forEach(b=>b.onclick=()=>{ const s=b.dataset.st; const o={...a,status:s}; if(s==="fertig"&&!o.erledigt) o.erledigt=today(); if(s==="abgeholt"){ if(!o.erledigt) o.erledigt=today(); if(!o.abgeholtAm) o.abgeholtAm=today(); } save("auftraege",o); toast(STATUS[s].l); openJobDetail(a.id); });
    const dt=$("#doneToday"); if(dt) dt.onclick=()=>{ save("auftraege",{...a,status:"fertig",erledigt:today()}); toast("Als repariert eingetragen"); openJobDetail(a.id); };
    $("#editJob").onclick=()=>openAuftrag(a.id);
    $("#mkInv").onclick=()=>openDocEditor({typ:"rechnung", auftragId:a.id});
    $("#mkKva").onclick=()=>openDocEditor({typ:"kva", auftragId:a.id});
    $$("#sBody [data-doc]").forEach(b=>b.onclick=()=>openDoc(b.dataset.doc));
    $$("#sBody [data-aus]").forEach(b=>b.onclick=()=>openAusgabe(b.dataset.aus)); fillThumbs($("#sBody"));
    $("#jobAus").onclick=()=>newAusgabe(a.id);
  }

  /* ---------- Dokument-Editor ---------- */
  function newDocFrom({typ="rechnung", auftragId="", kundeId="", from=null}){
    const f=S.firma, d=today();
    const base = { id:uid(), typ, nr:"", status:"entwurf", kundeId, auftragId, geraet:"", imei:"", datum:d, leistung:d,
      faellig:addDays(d, typ==="rechnung" ? +(f.ziel??14) : 30), positionen:[], ku:!!f.kleinunternehmer, mwst:f.kleinunternehmer?0:19, brutto:!f.netto, rabatt:0, notiz:defaultNote(typ), verlauf:[], created:nowStamp() };
    if(from){ Object.assign(base, {kundeId:from.kundeId, auftragId:from.auftragId||"", geraet:from.geraet||"", imei:from.imei||"", positionen:(from.positionen||[]).map(p=>({...p})), ku:dKu(from), mwst:dMwst(from), brutto:dBrutto(from), rabatt:from.rabatt||0, ausDoc:from.id}); }
    if(auftragId){ const a=S.auftraege.find(x=>x.id===auftragId); if(a) Object.assign(base, {kundeId:a.kundeId, geraet:a.geraet, imei:a.imei||"", leistung:a.erledigt||d, positionen:(a.positionen||[]).map(p=>({einheit:"Stk.",...p}))}); }
    return base;
  }
  function openDocEditor(o){
    const existing = o.id ? S.rechnungen.find(r=>r.id===o.id) : null;
    const d = existing ? JSON.parse(JSON.stringify(existing)) : newDocFrom(o);
    if(!d.verlauf) d.verlauf=[];
    renderEditor(d, !!existing);
  }
  function collectEditor(d){
    const k=readKunde("e"); d._kundeNeu=null; d._kErr=null;
    if(k.neu){ d._kundeNeu=k.neu; d.kundeId=k.id; } else if(!k.err) d.kundeId=k.id; else d._kErr=k.err;
    d.auftragId=val("eAuftrag"); d.datum=val("eDatum")||today(); d.faellig=val("eFaellig"); d.leistung=val("eLeistung")||d.datum;
    d.geraet=val("eGeraet"); d.positionen=readPos();
    d.ku=$("#eKu").checked; d.mwst=d.ku?0:Math.max(0,parseNum(val("eMwst"))); d.rabatt=Math.max(0,Math.min(100,parseNum(val("eRabatt")))); d.brutto=$("#eBrutto").checked; d.notiz=$("#eNotiz").value.trim();
    return d;
  }
  function renderEditor(d, isEdit){
    const T=TYP[d.typ];
    const jobs=S.auftraege.filter(a=>!d.kundeId || a.kundeId===d.kundeId).sort((x,y)=>(y.created||"").localeCompare(x.created||""));
    const jOpts=jobs.map(a=>`<option value="${a.id}" ${d.auftragId===a.id?"selected":""}>#${esc(a.nr)} · ${esc(a.geraet)}</option>`).join("");
    const title = isEdit ? `${T.l} bearbeiten` : ({rechnung:"Neue Rechnung", angebot:"Neues Angebot", kva:"Neuer Kostenvoranschlag"})[d.typ];
    openSheet(title, `
      <div class="sec"><h4>${ico.doc}Dokumenttyp</h4>
        <div class="seg">${Object.entries(TYP).map(([k,v])=>`<button type="button" data-typ="${k}" aria-pressed="${d.typ===k}">${k==="kva"?"KVA":v.l}</button>`).join("")}</div>
        ${d.typ==="kva"?`<p class="help">Kostenvoranschlag: unverbindliche Schätzung vor der Reparatur.</p>`:""}</div>
      <div class="sec"><h4>${ico.card}Kunde &amp; Auftrag</h4>
        <span class="lbl">Kunde *</span>${kundeSelect(d.kundeId,"e")}
        <div style="border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:6px"><span class="lbl">Verknüpfter Auftrag (optional)</span>
        <select id="eAuftrag" class="input"><option value="">Auftrag hinzufügen…</option>${jOpts}</select>
        <input id="eGeraet" class="input" placeholder="Gerät / Betreff, z. B. iPhone X – Ladebuchse" value="${esc(d.geraet)}"></div></div>
      <div class="sec"><h4>${ico.cal}Datum</h4>
        <div class="lineform"><span>${d.typ==="rechnung"?"Rechnungsdatum":"Datum"}</span><input type="date" class="input" id="eDatum" value="${d.datum}"></div>
        <div class="lineform"><span>${T.dateL}</span><input type="date" class="input" id="eFaellig" value="${d.faellig||""}"></div>
        <div class="lineform"><span>Leistungsdatum</span><input type="date" class="input" id="eLeistung" value="${d.leistung||d.datum}"></div></div>
      ${posSection(d.positionen)}
      <div class="sec"><h4>${ico.pct}Steuern &amp; Rabatt</h4>
        <div class="lineform"><span><b class="tl">Kleinunternehmer (§ 19 UStG)</b><small class="tsub">Ohne Umsatzsteuer abrechnen</small></span><input type="checkbox" class="toggle" id="eKu" ${dKu(d)?"checked":""}></div>
        <div class="lineform" id="eMwstRow"><span>MwSt. (%)</span><input class="input" id="eMwst" inputmode="decimal" value="${numIn(dKu(d)?0:d.mwst)}" ${dKu(d)?"disabled":""}></div>
        <div class="lineform" id="eBruttoRow" ${dKu(d)?"hidden":""}><span><b class="tl">Preise enthalten MwSt.</b><small class="tsub" id="eBruttoTxt"></small></span><input type="checkbox" class="toggle" id="eBrutto" ${d.brutto?"checked":""}></div>
        <div class="kuhint" id="eKuHint" ${dKu(d)?"":"hidden"}>${ico.doc}<span><b>Brutto = Netto.</b> Auf dem Beleg steht automatisch:<br><i>„Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“</i></span></div>
        <div class="lineform"><span>Rabatt (%)</span><input class="input" id="eRabatt" inputmode="decimal" placeholder="0" value="${d.rabatt?numIn(d.rabatt):""}"></div>
        <div class="sumlines" id="docSum">${sumLinesHtml(calc(d))}</div></div>
      <div class="sec"><h4>${ico.text}<span class="sp">Hinweis auf dem Blatt</span>${defaultNote(d.typ)?`<button type="button" class="linkbtn" id="eNoteStd">Standardtext</button>`:""}</h4><textarea id="eNotiz" class="input" rows="4" placeholder="${d.typ==="rechnung"?"z. B. Garantie-Hinweis – Standardtext unter Einstellungen › Textbausteine":"z. B. Reparaturdauer – Standardtext unter Einstellungen › Textbausteine"}">${esc(d.notiz)}</textarea>
        ${S.firma.haftung?`<p class="help" style="margin:0">Der Haftungsausschluss aus den Textbausteinen steht zusätzlich klein unten auf dem Blatt.</p>`:""}</div>
      ${isEdit?`<button class="btn danger" id="delDoc">Entwurf löschen</button><div id="delConfirm"></div>`:""}
    `, null, "", {
      onRight:()=>{ collectEditor(d); openViewer(d, `<b>Vorschau – noch nicht gespeichert</b><span>${d.nr?"":"Entwurf · Die Nummer wird beim Erstellen vergeben."}</span>`); },
      rightIcon:ico.preview, rightLabel:"Vorschau",
      foot:`<button class="btn wide" id="eDraft">${ico.checkc} Als Entwurf speichern</button><button class="btn accent wide" id="eMake">${T.make}</button>`
    });
    bindKundeSelect("e");
    const refreshSum=()=>{ const ku=$("#eKu").checked; const t={...d, positionen:readPos(), ku, mwst:ku?0:parseNum(val("eMwst")), rabatt:parseNum(val("eRabatt")), brutto:$("#eBrutto").checked}; $("#docSum").innerHTML=sumLinesHtml(calc(t)); };
    const bruttoTxt=()=>{ $("#eBruttoTxt").textContent = $("#eBrutto").checked ? "Eingabe ist Brutto (Endpreis inkl. MwSt.)" : "Eingabe ist Netto (zzgl. MwSt.)"; };
    let mwstMerk = dKu(d) ? (d.mwst||19) : d.mwst;
    const kuSync=()=>{ const ku=$("#eKu").checked, m=$("#eMwst");
      if(ku){ if(!m.disabled){ const v=parseNum(m.value); mwstMerk = v>0 ? v : (mwstMerk||19); } m.value="0"; m.disabled=true; }
      else if(m.disabled){ m.disabled=false; m.value=numIn(mwstMerk>0?mwstMerk:19); }
      $("#eMwstRow").classList.toggle("off",ku); $("#eBruttoRow").hidden=ku; $("#eKuHint").hidden=!ku; refreshSum(); };
    bindPos(refreshSum); bruttoTxt();
    ["eMwst","eRabatt"].forEach(i=>$("#"+i).oninput=refreshSum); $("#eBrutto").onchange=()=>{ bruttoTxt(); refreshSum(); }; $("#eKu").onchange=kuSync;
    const keepK=()=>{ if(d._kundeNeu){ save("kunden",d._kundeNeu); d._kundeNeu=null; } };
    const ns=$("#eNoteStd"); if(ns) ns.onclick=()=>{ $("#eNotiz").value=defaultNote(d.typ); };
    $$("[data-typ]").forEach(b=>b.onclick=()=>{ collectEditor(d); keepK(); const old=d.typ; d.typ=b.dataset.typ;
      if(old!==d.typ && (old==="rechnung")!==(d.typ==="rechnung")){ d.faellig=addDays(d.datum, d.typ==="rechnung"?+(S.firma.ziel??14):30); if(!d.notiz || d.notiz===defaultNote(old)) d.notiz=defaultNote(d.typ); }
      renderEditor(d,isEdit); });
    $("#eKunde").onchange=()=>{ collectEditor(d); keepK(); renderEditor(d,isEdit); };
    $("#eAuftrag").onchange=()=>{ collectEditor(d); keepK(); const a=S.auftraege.find(x=>x.id===d.auftragId); if(a){ d.kundeId=a.kundeId||d.kundeId; d.geraet=a.geraet; d.imei=a.imei||""; d.leistung=a.erledigt||d.leistung; if(!d.positionen.length) d.positionen=(a.positionen||[]).map(p=>({einheit:"Stk.",...p})); } renderEditor(d,isEdit); };
    const finish=(make)=>{
      collectEditor(d);
      if(d._kErr){ toast(d._kErr); return; }
      if(make){ if(!d.kundeId){ toast("Bitte einen Kunden wählen"); $("#eKunde").focus(); return; } if(!d.positionen.length){ toast("Bitte mindestens eine Position eintragen"); return; } }
      if(d._kundeNeu) save("kunden", d._kundeNeu);
      const out={...d}; delete out._kundeNeu; delete out._kErr; delete out.bezahlt; delete out.kleinunternehmer;
      if(make){
        out.nr=nextNr(out.typ); out.status="offen"; out.verlauf=[...(out.verlauf||[]), {t:nowStamp(), e:"Erstellt"}];
        if(out.typ==="rechnung") for(const p of out.positionen) if(p.teilId){ const t=S.teile.find(x=>x.id===p.teilId); if(t && t.kategorie!=="Dienstleistung") save("teile",{...t,bestand:Math.max(0,(+t.bestand||0)-(+p.menge||0))}); }
        if(out.ausDoc){ const src=S.rechnungen.find(x=>x.id===out.ausDoc); if(src && dStatus(src)!=="akzeptiert") save("rechnungen",{...src,status:"akzeptiert",verlauf:[...(src.verlauf||[]),{t:nowStamp(),e:`In Rechnung ${out.nr} übernommen`}]}); }
      } else if(!out.verlauf.length) out.verlauf=[{t:nowStamp(), e:"Entwurf angelegt"}];
      save("rechnungen", out); UI.view="rechnungen"; UI.docSeg = out.typ==="rechnung"?"rechnungen":"angebote"; UI.docFilter="alle";
      toast(make?`${TYP[out.typ].l} ${out.nr} erstellt`:"Entwurf gespeichert");
      openDoc(out.id);
    };
    $("#eDraft").onclick=()=>finish(false); $("#eMake").onclick=()=>finish(true);
    const dd=$("#delDoc"); if(dd) dd.onclick=()=>confirmBox("Diesen Entwurf löschen?", ()=>{ remove("rechnungen",d.id); closeSheet(); toast("Entwurf gelöscht"); });
  }
  function sumLinesHtml(c){
    return `${c.rab?`<div><span>Positionen</span><span>${eur(c.sum)}</span></div><div><span>Rabatt</span><span>− ${eur(c.rab)}</span></div>`:""}
      ${c.p?`<div><span>Zwischensumme (netto)</span><span>${eur(c.netto)}</span></div><div><span>MwSt. (${numIn(c.p)} %)</span><span>${eur(c.mwst)}</span></div>`:""}
      <div class="g"><span>Gesamtbetrag</span><span>${eur(c.brutto)}</span></div>`;
  }

  /* ---------- Dokument-Übersicht ---------- */
  function openDoc(id){
    const r=S.rechnungen.find(x=>x.id===id); if(!r) return; pushRecent("doc",id);
    const t=dTyp(r), T=TYP[t], st=dStatus(r), c=calc(r), k=kunde(r.kundeId), job=S.auftraege.find(a=>a.id===r.auftragId);
    const missing=!S.firma.name||!S.firma.iban;
    const impHint = r.importiert ? `<div class="hint"><span><b>Importierter Beleg.</b> Das Blatt hier ist eine Nachbildung aus den importierten Daten. Das Original-PDF bleibt Ihr Beleg – bitte im sevdesk-Archiv aufbewahren (10 Jahre).</span></div>` : "";
    const verlauf=[...(r.verlauf||[])].reverse();
    openSheet(`${T.l}<small>${esc(shownNr(r))}</small>`, `
      <div class="card" style="gap:10px">
        <div class="row"><span class="pill s-${st}">${DST[st]}</span><span class="tag mono" style="font-size:12.5px">${esc(shownNr(r))}</span></div>
        <div class="big">${eur(c.brutto)}</div>
        <div class="meta"><span>${ico.cal}Erstellt: ${deDate(r.datum)}</span>${r.faellig?`<span>${ico.clock}${T.dateL}: ${deDate(r.faellig)}</span>`:""}${st==="bezahlt"&&r.bezahltAm?`<span style="color:var(--green)">${ico.check}bezahlt ${deDate(r.bezahltAm)}</span>`:""}</div>
        <button class="btn soft wide" id="dView">${ico.preview} Blatt ansehen</button>
        ${st==="entwurf"?`<div class="btnrow"><button class="btn" id="dEdit" style="flex:1">Bearbeiten</button></div>`:""}
        ${t!=="rechnung" && st!=="entwurf" && st!=="abgelehnt"?`<button class="btn accent wide" id="dToInv">${ico.doc} In Rechnung umwandeln</button>`:""}
      </div>
      ${impHint}${missing?`<div class="hint"><span><b>Firmendaten fehlen.</b> Name und IBAN unter Einstellungen eintragen, dann stehen sie auf dem Blatt.</span></div>`:""}
      <div class="card"><h4>${ico.card}Kunde &amp; Auftrag</h4>
        <div class="row" style="padding:4px 0"><span style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:16.5px"><span style="color:var(--link);display:inline-flex;width:20px">${ico.user}</span>${esc(k?.name||"Ohne Kunde")}</span>${k?`<button class="linkbtn" id="dKunde">Kunde öffnen ${ico.right}</button>`:""}</div>
        ${job?`<div class="row" style="padding:4px 0"><span style="color:var(--muted)">#${esc(job.nr)} · ${esc(job.geraet)}</span><button class="linkbtn" id="dJob">Auftrag ${ico.right}</button></div>`:(r.geraet?`<div class="meta">${ico.phone}${esc(r.geraet)}</div>`:"")}</div>
      <div class="card"><div class="row"><h4>${ico.list}Positionen</h4><span style="color:var(--muted)">${r.positionen.length} Pos.</span></div>
        <div class="plist"><div class="ph"><span>Pos. Beschreibung</span><span>Gesamt</span></div>
        ${r.positionen.map((p,i)=>`<div class="pi"><span class="n">${i+1}.</span><span>${esc(p.bez)}</span><strong class="num">${eur(p.menge*p.preis)}</strong><small>${numIn(p.menge)} ${esc(p.einheit||"Stk.")} × ${eur(p.preis)}</small></div>`).join("")}</div>
        <div class="sumlines">${sumLinesHtml(c)}</div></div>
      <div class="card"><h4>${ico.hist}Verlauf</h4><div class="tl">${verlauf.length?verlauf.map(v=>`<div><i></i><b>${esc(v.e)}</b><small>${deStamp(v.t)}</small></div>`).join(""):`<span style="color:var(--muted)">Noch keine Einträge</span>`}</div></div>
      ${st!=="entwurf"?`<div class="card"><h4>${ico.send}Versenden</h4>
        <span style="color:var(--muted)">PDF speichern oder teilen, dann per E-Mail, WhatsApp oder Post an den Kunden. Den Text dazu können Sie kopieren.</span>
        ${k?.mail?`<div class="meta"><span>An: <span style="user-select:all;color:var(--fg)">${esc(k.mail)}</span></span></div>`:""}
        <textarea class="mailtext" id="dMail" readonly>${esc(mailText(r))}</textarea>
        <div class="btnrow"><button class="btn" id="dCopy">${ico.copy} Text kopieren</button>${st==="offen"?`<button class="btn ghost" id="dSent">Als versendet markieren</button>`:""}</div></div>`:""}
      <div class="card"><h4>${ico.doc}${T.l} als PDF</h4>
        <span><b>${st==="entwurf"?"Entwurf":"Original"}</b> <span style="color:var(--muted)">· ${st==="entwurf"?"Nummer folgt beim Erstellen.":"Gespeicherte Fassung des Belegs."} · Design: ${LAYOUTS[pdfLayout()].l}</span></span>
        <div class="btnrow"><button class="btn soft" id="dPdf">${ico.share} PDF speichern / teilen</button></div>
        <div id="dThumb" style="margin-top:6px">${paperBox(r)}</div>
        <span style="color:var(--muted)">Zum Vergrößern auf das Blatt tippen.</span></div>
      <button class="btn danger" id="dDel">${st==="entwurf"?"Entwurf löschen":"Löschen"}</button><div id="delConfirm"></div>
    `, null, "", { cancelLabel:"Zurück", foot: st==="entwurf"
        ? `<button class="btn accent wide" id="dMake">${T.make}</button>`
        : `<button class="btn ghost wide" id="dStatus">${ico.sync} Status ändern</button>` });
    const note = st==="entwurf" ? `<b>Entwurf</b><span>Die Nummer wird beim Erstellen vergeben.</span>` : r.importiert ? `<b>Nachbildung</b><span>Importierter Beleg – das Original ist die PDF aus sevdesk.</span>` : "";
    $$("#dThumb img").forEach(i=>i.complete||i.addEventListener("load",()=>fitPapers($("#sheet")),{once:true}));
    $("#dView").onclick=()=>openViewer(r, note);
    $("#dThumb").onclick=()=>openViewer(r, note);
    const de=$("#dEdit"); if(de) de.onclick=()=>openDocEditor({id:r.id});
    const dm=$("#dMake"); if(dm) dm.onclick=()=>{ openDocEditor({id:r.id}); setTimeout(()=>$("#eMake")?.click(),0); };
    const ti=$("#dToInv"); if(ti) ti.onclick=()=>{ const d=newDocFrom({typ:"rechnung", from:r}); renderEditor(d,false); };
    const dk=$("#dKunde"); if(dk) dk.onclick=()=>openKunde(k.id);
    const dj=$("#dJob"); if(dj) dj.onclick=()=>openJobDetail(job.id);
    $("#dPdf").onclick=()=>savePdf(r);
    const cp=$("#dCopy"); if(cp) cp.onclick=()=>{ const ta=$("#dMail"); const done=()=>toast("Text kopiert"); try{ navigator.clipboard.writeText(ta.value).then(done,()=>{ ta.focus(); ta.select(); toast("Text markiert – jetzt kopieren"); }); }catch(e){ ta.focus(); ta.select(); toast("Text markiert – jetzt kopieren"); } };
    const sn=$("#dSent"); if(sn) sn.onclick=()=>setDocStatus(r,"versendet");
    const ds=$("#dStatus"); if(ds) ds.onclick=()=>{
      const opts = t==="rechnung" ? ["offen","versendet","bezahlt","storniert"] : ["offen","versendet","akzeptiert","abgelehnt"];
      const subs = {offen:"Erstellt, noch nicht verschickt", versendet:"An den Kunden geschickt", bezahlt:"Geld ist eingegangen (heute)", storniert:"Rechnung ungültig, bleibt zur Nachweisführung erhalten", akzeptiert:"Kunde hat zugesagt", abgelehnt:"Kunde hat abgesagt"};
      openPicker("Status ändern", opts.filter(s=>s!==(r.status||"offen")).map(s=>({label:DST[s], sub:subs[s], pill:s, value:s})), o=>setDocStatus(r,o.value));
    };
    $("#dDel").onclick=()=>confirmBox(st==="entwurf"?"Diesen Entwurf löschen?":`${T.l} ${esc(r.nr)} wirklich löschen? Bei verschickten Rechnungen besser den Status „Storniert“ setzen.`, ()=>{ remove("rechnungen",r.id); closeSheet(); toast("Gelöscht"); });
  }
  function setDocStatus(r, s){
    const o={...r, status:s, verlauf:[...(r.verlauf||[]), {t:nowStamp(), e:`Status: ${DST[s]}`}]};
    if(s==="bezahlt") o.bezahltAm=today(); else if(r.status==="bezahlt") o.bezahltAm="";
    delete o.bezahlt; save("rechnungen",o); toast(`Status: ${DST[s]}`); openDoc(r.id);
  }
  function mailText(r){
    const k=kunde(r.kundeId)||{}, f=S.firma, t=dTyp(r), c=calc(r);
    const anrede = k.name ? `Hallo ${k.name},` : "Guten Tag,";
    const body = t==="rechnung"
      ? `anbei erhalten Sie unsere Rechnung ${r.nr} über ${eur(c.brutto)}${r.geraet?` für die Reparatur „${r.geraet}“`:""}.${f.iban?`\nBitte überweisen Sie den Betrag auf folgendes Konto:\nIBAN ${f.iban}${f.bank?` (${f.bank})`:""}`:""}\nVerwendungszweck: ${r.nr}`
      : `anbei erhalten Sie unser${t==="kva"?"en Kostenvoranschlag":" Angebot"} ${r.nr} über ${eur(c.brutto)}${r.geraet?` für „${r.geraet}“`:""}.\nEs gilt bis zum ${deDate(r.faellig)}. Geben Sie uns einfach kurz Bescheid, ob wir die Reparatur durchführen sollen.`;
    return `${anrede}\n\n${body}\n\nVielen Dank und freundliche Grüße\n${f.name||""}${f.tel?`\nTel. ${f.tel}`:""}`;
  }

  /* ---------- Belegtexte (shared by paper + PDF) ---------- */
  function docTexts(r){
    const f=S.firma, t=dTyp(r), c=calc(r), k=kunde(r.kundeId)||r._kundeNeu||{};
    const intro = t==="rechnung" ? "vielen Dank für Ihren Auftrag. Für die erbrachten Leistungen berechnen wir Ihnen:" : t==="kva" ? "gerne schätzen wir die Kosten der Reparatur wie folgt:" : "gerne unterbreiten wir Ihnen folgendes Angebot:";
    const pay = t==="rechnung"
      ? (dStatus(r)==="bezahlt" ? `Betrag dankend erhalten${r.bezahltAm?" am "+deDate(r.bezahltAm):""}.` : "")
      : t==="kva" ? `Dieser Kostenvoranschlag ist unverbindlich und gilt bis zum ${deDate(r.faellig)}. Sollten sich die Kosten wesentlich erhöhen, informieren wir Sie vorher.`
      : `Dieses Angebot gilt bis zum ${deDate(r.faellig)}. Wir freuen uns auf Ihren Auftrag.`;
    return { k, intro, pay, anrede: k.name?`Hallo ${k.name},`:"Sehr geehrte Damen und Herren,", klein: !c.p && dKu(r),
      stamp: !!f.stempel && t==="rechnung" && dStatus(r)==="bezahlt" };
  }

  /* ---------- A4 paper ---------- */
  const noteBody = (X,r) => [X.pay, r.notiz ? esc(r.notiz).replace(/\n/g,"<br>") : ""].filter(Boolean).join("<br><br>");
  function kundenNr(k){ if(!k||!k.id) return k?.nr?String(k.nr):""; if(k.nr) return String(k.nr);
    const sorted=[...S.kunden].sort((a,b)=>(a.created||"").localeCompare(b.created||"")||a.id.localeCompare(b.id)); const i=sorted.findIndex(x=>x.id===k.id); return i<0?"":String(1001+i); }
  function nextKundenNr(){ return String(Math.max(1000, ...S.kunden.map(k=>parseInt(kundenNr(k))||0))+1); }
  const eurTxt = n => new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(+n||0)+" EUR";
  const qtyTxt = n => new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:3}).format(+n||0);
  function neutralData(r,D){
    const {f,t,T,k}=D;
    const meta=[[`${T.l}s-Nr.`, r.nr||shownNr(r)], [t==="rechnung"?"Rechnungsdatum":"Datum", deDate(r.datum)], ["Lieferdatum", deDate(r.leistung||r.datum)],
      t==="rechnung"?null:["Gültig bis", deDate(r.faellig)], ["Ihre Kundennummer", kundenNr(k)], ["Ihr Ansprechpartner", f.ansprechpartner||""]].filter(x=>x&&x[1]);
    const leist = (!r.leistung || r.leistung===r.datum) ? `${t==="rechnung"?"Rechnungsdatum":"Datum"} entspricht Leistungsdatum` : `Leistungsdatum: ${deDate(r.leistung)}`;
    const thanks = t==="rechnung" ? "Wir bedanken uns für Ihren Auftrag und freuen uns auf die weitere Zusammenarbeit." : "Wir freuen uns auf Ihre Rückmeldung.";
    const nm=(f.name||"").match(/^([A-ZÄÖÜ][a-zäöüß]+)([A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*)$/);
    return {meta, leist, thanks, nm, senderParts:[f.name,f.strasse,[f.plz,f.ort].filter(Boolean).join(" ")].filter(Boolean)};
  }
  const LABOR_RX=/arbeit|lohn|pauschal|diagnose|einbau|montage|service|reinigung|software|datenrettung|fehlersuche|reparatur$/i;
  const posGroup = p => p.teilId ? (S.teile.find(x=>x.id===p.teilId)?.kategorie==="Dienstleistung" ? "lohn" : "teil") : (["Std.","Min."].includes(p.einheit) || LABOR_RX.test((p.bez||"").trim())) ? "lohn" : "teil";
  function docParts(r){
    const f=S.firma, c=calc(r), t=dTyp(r), T=TYP[t], X=docTexts(r), k=X.k, job=S.auftraege.find(a=>a.id===r.auftragId);
    const firm=[f.strasse, [f.plz,f.ort].filter(Boolean).join(" ")].filter(Boolean);
    const meta=[[t==="rechnung"?"Rechnungsdatum":"Datum", deDate(r.datum)],[T.dateL, deDate(r.faellig)],["Leistungsdatum", deDate(r.leistung||r.datum)],[`${T.l}s-Nr.`, r.nr||"—"]];
    const addr=[k.firma&&k.firma!==k.name?k.firma:"",k.name,k.strasse,[k.plz,k.ort].filter(Boolean).join(" "),k.land].filter(Boolean);
    const due = t==="rechnung" ? (dStatus(r)==="bezahlt" ? `bezahlt${r.bezahltAm?" am "+deDate(r.bezahltAm):""}` : `fällig am ${deDate(r.faellig)}`) : `gültig bis ${deDate(r.faellig)}`;
    const devItems=[["Gerät",r.geraet||job?.geraet],["IMEI / Seriennr.",r.imei||job?.imei],["Auftrag",job?"#"+job.nr:""],["Zubehör",job?.zubehoer],["Angenommen",job?.created?deDate(job.created):""],["Repariert am",job?.erledigt?deDate(job.erledigt):""]].filter(x=>x[1]);
    return {f,c,t,T,X,k,job,firm,meta,addr,due,devItems, problem:job?.problem||"", sender:[f.name,...firm].filter(Boolean).join(" · ")};
  }
  function paperHtml(r){
    const D=docParts(r), {f,c,t,T,X}=D, lay=pdfLayout(), e=esc, br=a=>a.map(esc).join("<br>");
    const logo = docLogo() ? `<img class="logo" src="${docLogo()}" alt="">` : `<div class="logo logotxt">${e(f.name||"Ihr Firmenname")}</div>`;
    const contact=`<b>${e(f.name)}</b><br>${br(D.firm)}${f.tel?`<br>Tel. ${e(f.tel)}`:""}${f.mail?`<br>${e(f.mail)}`:""}`;
    const meta=`<div class="meta2">${D.meta.map(([a,b])=>`<b>${e(a)}:</b><span>${e(b)}</span>`).join("")}</div>`;
    const nrHtml = r.nr?e(r.nr):`<span class="draft">${e(shownNr(r))}</span>`;
    const title=`<div class="title">${T.up} ${nrHtml}</div>`;
    const sub=r.geraet?`<div class="sub">Gerät: ${e(r.geraet)}${r.imei?` · IMEI/SN ${e(r.imei)}`:""}</div>`:"";
    const intro=`<div class="intro">${e(X.anrede)}<br>${X.intro}</div>`;
    const row=(p,i)=>`<tr><td>${i}</td><td>${e(p.bez)}</td><td class="r">${numIn(p.menge)}</td><td class="c">${e(p.einheit||"Stk.")}</td><td class="r">${eur(p.preis)}</td><td class="r"><b>${eur(p.menge*p.preis)}</b></td></tr>`;
    const thead=`<thead><tr><th style="width:44px">Pos.</th><th>Beschreibung</th><th class="r">Menge</th><th class="c">Einheit</th><th class="r">Einzelpreis</th><th class="r">Gesamt</th></tr></thead>`;
    const empty=`<tr><td colspan="6" style="color:var(--ink-2)">Noch keine Positionen</td></tr>`;
    let rows;
    if(lay==="werkstatt"){
      let n=0; const g={lohn:[],teil:[]}; r.positionen.forEach(p=>g[posGroup(p)].push(p));
      const sec=(key,label)=> g[key].length?`<tr class="grp"><td colspan="6">${label}</td></tr>${g[key].map(p=>row(p,++n)).join("")}<tr class="sub"><td colspan="5">Summe ${label}</td><td class="r">${eur(sumPos(g[key]))}</td></tr>`:"";
      rows=sec("lohn","Arbeitsleistung")+sec("teil","Ersatzteile &amp; Material") || empty;
    } else rows=r.positionen.length?r.positionen.map((p,i)=>row(p,i+1)).join(""):empty;
    const table=`<div class="tbl"><table>${thead}<tbody>${rows}</tbody></table></div>`;
    const sum=`<div class="sum">${c.rab?`<div><span>Summe Positionen</span><span>${eur(c.sum)}</span></div><div><span>Rabatt (${numIn(r.rabatt)} %)</span><span>− ${eur(c.rab)}</span></div>`:""}${c.p?`<div><span>Zwischensumme (netto)</span><span>${eur(c.netto)}</span></div><div><span>MwSt. (${numIn(c.p)} %)</span><span>${eur(c.mwst)}</span></div>`:""}<div class="g"><span>${c.p?"Gesamtbetrag (brutto)":"Gesamtbetrag"}</span><span>${eur(c.brutto)}</span></div></div>`;
    const note=`<div class="note">${X.klein?"Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.<br>":""}${noteBody(X,r)}</div>`;
    const greet=`<div class="greet">Mit freundlichen Grüßen<b>${e(f.name||"")}</b></div>`;
    const haft=f.haftung?`<div class="haft">${e(f.haftung).replace(/\n/g,"<br>")}</div>`:"";
    const foot=`<div class="foot"><div>${e(f.name)}<br>${br(D.firm)}</div><div>${f.bank?e(f.bank)+"<br>":""}${f.iban?"IBAN "+e(f.iban)+"<br>":""}${f.bic?"BIC "+e(f.bic):""}</div><div>${f.tel?"Tel. "+e(f.tel)+"<br>":""}${f.stnr?"Steuernr. "+e(f.stnr)+"<br>":""}${f.ustid?"USt-IdNr. "+e(f.ustid):""}</div></div>`;
    const stamp=X.stamp?`<div class="stamp">BEZAHLT${r.bezahltAm?`<small>am ${deDate(r.bezahltAm)}</small>`:""}</div>`:"";
    const addrBlock=`<div><span class="sender">${e(D.sender)}</span><div class="addr">${br(D.addr)}</div></div>`;
    const body=(withSub=true)=>`${withSub?sub:""}${intro}${table}${sum}${note}${greet}<div class="spacer"></div>${haft}`;
    const devbox = (D.devItems.length||D.problem) ? `<div class="devbox"><div class="dv-grid">${D.devItems.map(([a,b])=>`<div><label>${a}</label><b>${e(b)}</b></div>`).join("")}</div>${D.problem?`<div class="dv-prob"><label>Fehlerbeschreibung</label>${e(D.problem)}</div>`:""}</div>` : "";

    if(lay==="neutral"){ const N=neutralData(r,D);
      const prow=(p,i)=>`<tr><td><div class="dd"><span class="n">${i+1}.</span><span class="d">${e(p.bez)}</span></div></td><td class="r">${qtyTxt(p.menge)} ${e(p.einheit||"Stk.")}</td><td class="r">${eurTxt(p.preis)}</td><td class="r">${eurTxt(p.menge*p.preis)}</td></tr>`;
      const srow=(a,b,cls="")=>`<tr class="${cls}"><td colspan="3">${a}</td><td class="r">${b}</td></tr>`;
      const tax = c.p ? srow(`zzgl. Umsatzsteuer ${numIn(c.p)} %`, eurTxt(c.mwst)) : srow(dKu(r)?"Umsatzsteuer nicht erhoben gemäß § 19 UStG.":"Umsatzsteuer 0 %", "");
      const cols=[[["",f.name],["",f.strasse],["",[f.plz,f.ort].filter(Boolean).join(" ")]],[["Tel",f.tel],["Mail",f.mail]],[["Bank",f.bank],["IBAN",f.iban],["BIC",f.bic]],[["St.-Nr.",f.stnr],["USt-ID",f.ustid]]]
        .map(cl=>cl.filter(x=>x[1])).filter(cl=>cl.length);
      return `<div class="paper lay-neutral">${stamp}
        <div class="nt-logo">${logo}</div>
        <div class="nt-head"><div><div class="nt-sender">${N.senderParts.map(e).join(' <i>→</i> ')}</div><div class="addr">${br(D.addr)}</div></div>
          <div class="nt-meta">${N.meta.map(([a,b])=>`<span>${e(a)}</span><b>${e(b)}</b>`).join("")}</div></div>
        <div class="nt-title"><b>${e(T.l)} Nr. ${nrHtml}</b><span>${deDate(r.datum)}</span></div>
        <div class="nt-sub">${e(N.leist)}${r.geraet?`<br>Gerät: ${e(r.geraet)}${r.imei?` · IMEI/SN ${e(r.imei)}`:""}`:""}</div>
        <table class="nt-tbl"><thead><tr><th>Beschreibung</th><th class="r">Menge</th><th class="r">Einzelpreis</th><th class="r">Gesamtpreis</th></tr></thead>
          <tbody>${r.positionen.length?r.positionen.map(prow).join(""):`<tr><td colspan="4">Noch keine Positionen</td></tr>`}</tbody>
          <tbody class="nt-sum">${c.rab?srow("Summe Positionen",eurTxt(c.sum))+srow(`Rabatt (${numIn(r.rabatt)} %)`,"− "+eurTxt(c.rab)):""}${srow("Gesamtbetrag netto",eurTxt(c.netto),"g")}${tax}${srow("Gesamtbetrag brutto",`<b>${eurTxt(c.brutto)}</b>`,"g")}</tbody></table>
        ${noteBody(X,r)?`<div class="nt-text">${noteBody(X,r)}</div>`:""}
        <div class="nt-text">${e(N.thanks)}</div>
        <div class="nt-greet">Mit freundlichen Grüßen<b>${N.nm?`<span>${e(N.nm[1])}</span><span class="b2">${e(N.nm[2])}</span>`:e(f.name||"")}</b></div>
        <div class="spacer"></div>${haft}
        <div class="nt-foot">${cols.map(cl=>`<div>${cl.map(([a,b])=>`<p>${a?`<i>${e(a)}</i>`:""}<b>${e(b)}</b></p>`).join("")}</div>`).join("")}</div></div>`; }
    if(lay==="minimal") return `<div class="paper lay-minimal">${stamp}
      <div class="mn-top">${logo}<span class="mn-from">${e(D.sender)}</span></div>
      <div class="mn-hero"><div><div class="mn-kicker">${T.l} · ${nrHtml}</div><div class="mn-amount">${eur(c.brutto)}</div><div class="mn-due">${e(D.due)}</div></div>${meta}</div>
      <div class="mn-cols"><div><label>An</label>${br(D.addr)||"—"}</div><div><label>Von</label>${contact}</div></div>
      ${body()}${foot}</div>`;
    if(lay==="block") return `<div class="paper lay-block">${stamp}
      <div class="hb"><div class="hb-logo">${logo}</div><div class="hb-title"><span>${T.up}</span><b>${nrHtml}</b><small>${e(D.meta[0][0])}: ${e(D.meta[0][1])} · ${e(D.meta[1][0])}: ${e(D.meta[1][1])}</small></div></div>
      <div class="ph2">${addrBlock}<div class="fcontact">${contact}<br><br>Leistungsdatum: ${e(D.meta[2][1])}</div></div>${body()}${foot}</div>`;
    if(lay==="side") return `<div class="paper lay-side">${stamp}
      <aside class="sb"><div class="sb-logo">${logo}</div><div class="sb-sec">${contact}</div>
        ${(f.bank||f.iban)?`<div class="sb-sec"><label>Bankverbindung</label>${f.bank?e(f.bank)+"<br>":""}${f.iban?"IBAN "+e(f.iban)+"<br>":""}${f.bic?"BIC "+e(f.bic):""}</div>`:""}
        ${(f.stnr||f.ustid)?`<div class="sb-sec"><label>Steuer</label>${f.stnr?"Steuernr. "+e(f.stnr)+"<br>":""}${f.ustid?"USt-IdNr. "+e(f.ustid):""}</div>`:""}
        <div class="sb-sec"><label>${T.l}</label>${D.meta.map(([a,b])=>`<span>${e(a)}</span><b>${e(b)}</b>`).join("")}</div></aside>
      <section class="sm"><div class="addr"><label>${t==="rechnung"?"Rechnung an":"Für"}</label>${br(D.addr)||"—"}</div>${title}${body()}</section></div>`;
    return `<div class="paper lay-${lay}">${lay==="modern"||lay==="werkstatt"?`<div class="stripe"></div>`:""}
      ${lay==="din"?`<i class="fm" style="top:397px"></i><i class="fm" style="top:561px;width:28px"></i><i class="fm" style="top:794px"></i>`:""}${stamp}
      <div class="ph1"><div>${logo}</div><div class="fcontact">${contact}</div></div>
      <div class="ph2">${addrBlock}${meta}</div>${title}${lay==="werkstatt"?devbox:""}${body(lay!=="werkstatt")}${foot}</div>`;
  }
  function sampleDoc(){
    const real=[...S.rechnungen].filter(r=>dTyp(r)==="rechnung"&&r.nr).sort((a,b)=>(b.datum||"").localeCompare(a.datum||""))[0];
    if(real) return {...real, status:S.firma.stempel?"bezahlt":real.status, bezahltAm:real.bezahltAm||today()};
    return { typ:"rechnung", nr:`RE-${new Date().getFullYear()}-0001`, status:S.firma.stempel?"bezahlt":"offen", bezahltAm:today(), _kundeNeu:{name:"Max Mustermann (Beispiel)", strasse:"Hauptstraße 5", plz:"12345", ort:"Musterstadt"},
      geraet:"iPhone X – Ladebuchse", imei:"35 291611 482736 4", datum:today(), leistung:today(), faellig:addDays(today(),+(S.firma.ziel??14)), mwst:S.firma.kleinunternehmer?0:19, brutto:!S.firma.netto, rabatt:0, notiz:defaultNote("rechnung"),
      positionen:[{bez:"Ladebuchse iPhone X",menge:1,einheit:"Stk.",preis:29},{bez:"Arbeitszeit / Reparatur",menge:1,einheit:"psch.",preis:S.firma.pauschale??39}] };
  }

  /* ---------- PDF (seven layouts, vector text) ---------- */
  async function savePdf(r){
    if(!window.jspdf){ toast("PDF-Erstellung nicht verfügbar"); return; }
    const dl = await getDownloader();
    if(!dl){ toast("Speichern ist in dieser Ansicht nicht möglich"); return; }
    const doc=buildPdfDoc(r), T=TYP[dTyp(r)];
    try{ await dl.save({filename:`${r.nr||"Entwurf-"+T.l}.pdf`, data:doc.output("blob")}); toast("PDF bereit");
      if(r.nr && r.id){ const cur=S.rechnungen.find(x=>x.id===r.id); if(cur) save("rechnungen",{...cur, verlauf:[...(cur.verlauf||[]),{t:nowStamp(),e:"PDF gespeichert"}]}); } }
    catch(e){ if(e && !["cancelled","declined","aborted"].includes(e.code)) toast("PDF konnte nicht gespeichert werden"); }
  }
  function buildPdfDoc(r){
    const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:"mm",format:"a4"});
    const D=docParts(r), {f,c,t,T,X,job}=D, lay=pdfLayout();
    const NAVY=[12,35,64], GREY=[93,102,115], INK=[21,27,36], LINE=[222,226,231], TINT=[238,243,248], WHITE=[255,255,255];
    const ACC=hexRgb((ACCENTS[f.akzent]||ACCENTS.repair).c), ACCT=ACC.map(v=>Math.round(255-(255-v)*.12));
    const txt=(s,x,yy,o)=>doc.text(Array.isArray(s)?s:String(s??""),x,yy,o);
    const col=a=>doc.setTextColor(...a);
    const fnt=(st,sz)=>{ doc.setFont("helvetica",st); if(sz) doc.setFontSize(sz); };
    const lh=sz=>sz*.4234;
    const nrTxt=shownNr(r);
    const contactLines=[f.name,...D.firm, f.tel&&"Tel. "+f.tel, f.mail].filter(Boolean);
    const bankLines=[f.bank, f.iban&&"IBAN "+f.iban, f.bic&&"BIC "+f.bic].filter(Boolean);
    const taxLines=[f.stnr&&"Steuernr. "+f.stnr, f.ustid&&"USt-IdNr. "+f.ustid].filter(Boolean);

    // layout configuration
    const CFG = {
      modern:   {L:20,R:190,FS:9.5,foot:276,head:"box", headCol:NAVY,totalCol:ACC, totalLine:NAVY,rowGap:2.4,stampY:126},
      neutral:  {L:20,R:190,FS:8.3,foot:274,head:"line",headCol:INK, totalCol:INK, totalLine:INK, rowGap:2.4,stampY:132},
      werkstatt:{L:20,R:190,FS:9.5,foot:276,head:"fill",headCol:NAVY,totalCol:ACC, totalLine:NAVY,rowGap:2.4,stampY:150},
      din:      {L:25,R:190,FS:10, foot:276,head:"line",headCol:INK, totalCol:INK, totalLine:INK, rowGap:2.4,stampY:134},
      kompakt:  {L:15,R:195,FS:8.5,foot:281,head:"line",headCol:NAVY,totalCol:ACC, totalLine:NAVY,rowGap:1.5,stampY:98},
      minimal:  {L:22,R:188,FS:9.5,foot:278,head:"caps",headCol:GREY,totalCol:INK, totalLine:LINE,rowGap:3.2,stampY:122,rowLine:[236,238,241]},
      block:    {L:20,R:190,FS:9.5,foot:276,head:"fill",headCol:INK, totalCol:WHITE,totalLine:ACC, rowGap:2.4,stampY:122,total:"fill",headFill:ACCT},
      side:     {L:76,R:192,FS:9,  foot:286,head:"line",headCol:NAVY,totalCol:ACC, totalLine:NAVY,rowGap:2.2,stampY:120,contTop:22}
    }[lay];
    const {L,R,FS}=CFG; const SW=64;
    fnt("normal",7); const haftLines = f.haftung ? doc.splitTextToSize(f.haftung, R-L) : [];
    const bottom = CFG.foot-(lay==="side"?4:8)-haftLines.length*3.2-(haftLines.length?3:0);
    const RH=()=>lh(FS)*1.2;
    let y=0;

    const logoAt=(x,yy,mw,mh,plate)=>{ try{ const src=docLogo(), p=doc.getImageProperties(src), ra=p.width/p.height; let w=mw,h=w/ra; if(h>mh){h=mh;w=h*ra;}
        if(plate){ doc.setFillColor(...WHITE); doc.roundedRect(x-2.5,yy-2.5,w+5,h+5,2,2,"F"); }
        doc.addImage(src, src.startsWith("data:image/png")?"PNG":"JPEG", x,yy,w,h); return {w,h}; }
      catch(e){ fnt("bold",16); col(NAVY); txt(f.name||"",x,yy+7); return {w:60,h:9}; } };
    const lines=(arr,x,yy,sz,color,o={})=>{ arr.forEach((s,i)=>{ fnt(o.boldFirst&&i===0?"bold":"normal",sz); col(o.boldFirst&&i===0&&o.firstCol?o.firstCol:color); txt(s,x,yy+i*lh(sz)*1.18,o.align?{align:o.align}:undefined); }); return yy+arr.length*lh(sz)*1.18; };
    const metaAt=(x,xr,yy,sz,lc,vc)=>{ D.meta.forEach(([a,b],i)=>{ fnt("bold",sz); col(lc); txt(a+":",x,yy+i*lh(sz)*1.3); fnt("normal",sz); col(vc); txt(b,xr,yy+i*lh(sz)*1.3,{align:"right"}); }); };
    const senderLine=(x,yy)=>{ fnt("normal",6.5); col(GREY); txt(D.sender,x,yy); doc.setDrawColor(...GREY); doc.setLineWidth(.15); doc.line(x,yy+.8,x+Math.min(85,doc.getTextWidth(D.sender)),yy+.8); };
    const pageDeco=(first)=>{
      if(lay==="modern"||lay==="werkstatt"){ doc.setFillColor(...ACC); doc.rect(0,0,210,3.2,"F"); }
      if(lay==="block"){ doc.setFillColor(...ACC); doc.rect(0,0,210,first?44:3,"F"); }
      if(lay==="din"&&first){ doc.setDrawColor(150); doc.setLineWidth(.2); doc.line(4,105,9,105); doc.line(4,148.5,11,148.5); doc.line(4,210,9,210); }
      if(lay==="side"){ doc.setFillColor(...TINT); doc.rect(0,0,SW,297,"F"); }
    };
    const cols=()=>{ const narrow=(R-L)<130; return {pos:L+1.5, desc:L+11, menge:R-(narrow?56:64), einh:R-(narrow?46:52), ep:R-(narrow?22:25), ges:R-1.5}; };
    function tableHead(){
      const cx=cols(), hd=CFG.head; fnt("bold",FS-1);
      if(hd==="box"){ doc.setFillColor(...TINT); doc.setDrawColor(...NAVY); doc.setLineWidth(.4); doc.roundedRect(L,y-5,R-L,8,1.5,1.5,"FD"); doc.setDrawColor(...ACC); doc.setLineWidth(.6); doc.line(L+.5,y+3,R-.5,y+3); col(NAVY); }
      else if(hd==="fill"){ doc.setFillColor(...(CFG.headFill||TINT)); doc.rect(L,y-5,R-L,8,"F"); doc.setDrawColor(...ACC); doc.setLineWidth(.6); doc.line(L,y+3,R,y+3); col(CFG.headCol); }
      else if(hd==="caps"){ fnt("bold",6.8); col(GREY); }
      else col(CFG.headCol);
      const lab = hd==="caps" ? ["POS.","BESCHREIBUNG","MENGE","EINHEIT","EINZELPREIS","GESAMT"] : ["Pos.","Beschreibung","Menge","Einheit","Einzelpreis","Gesamt"];
      const o = hd==="caps" ? {charSpace:.4} : {};
      txt(lab[0],cx.pos,y,o); txt(lab[1],cx.desc,y,o); txt(lab[2],cx.menge,y,{...o,align:"right"}); txt(lab[3],cx.einh,y,{...o,align:"center"}); txt(lab[4],cx.ep,y,{...o,align:"right"}); txt(lab[5],cx.ges,y,{...o,align:"right"});
      if(hd==="line"||hd==="caps"){ doc.setDrawColor(...(hd==="caps"?LINE:CFG.headCol)); doc.setLineWidth(hd==="caps"?.25:.45); doc.line(L,y+2,R,y+2); }
      fnt("normal",FS); col(INK); y += (hd==="box"||hd==="fill") ? 9 : 7.5;
    }
    const ensure=(need,inTable)=>{ if(y+need>bottom){ doc.addPage(); pageDeco(false); y=CFG.contTop||25; if(inTable) tableHead(); } };
    function posRows(list,n){
      const cx=cols(), dw=(cx.menge-9)-cx.desc;
      list.forEach(p=>{ fnt("normal",FS); const ls=doc.splitTextToSize(p.bez||"",dw); ensure(ls.length*RH()+2,true);
        col(INK); txt(String(++n),cx.pos,y); txt(ls,cx.desc,y); txt(numIn(p.menge),cx.menge,y,{align:"right"}); txt(p.einheit||"Stk.",cx.einh,y,{align:"center"}); txt(eur(p.preis),cx.ep,y,{align:"right"});
        fnt("bold",FS); txt(eur(p.menge*p.preis),cx.ges,y,{align:"right"}); fnt("normal",FS);
        y+=ls.length*RH()+CFG.rowGap; doc.setDrawColor(...(CFG.rowLine||[228,231,235])); doc.setLineWidth(.2); doc.line(L,y-RH()+.4,R,y-RH()+.4); });
      return n;
    }
    function positions(){
      tableHead();
      if(lay!=="werkstatt"){ posRows(r.positionen,0); return; }
      const g={lohn:[],teil:[]}; r.positionen.forEach(p=>g[posGroup(p)].push(p)); let n=0; const cx=cols();
      [["lohn","ARBEITSLEISTUNG","Arbeitsleistung"],["teil","ERSATZTEILE & MATERIAL","Ersatzteile & Material"]].forEach(([key,cap,label])=>{
        if(!g[key].length) return; ensure(16,true);
        doc.setFillColor(...TINT); doc.rect(L,y-4,R-L,6,"F"); fnt("bold",7.5); col(NAVY); txt(cap,L+1.5,y,{charSpace:.3}); y+=6.5;
        n=posRows(g[key],n);
        fnt("normal",FS-1); col(GREY); txt(`Summe ${label}`,cx.ep,y-1.2,{align:"right"}); fnt("bold",FS-1); col(INK); txt(eur(sumPos(g[key])),cx.ges,y-1.2,{align:"right"}); y+=5.5; });
    }
    function totals(){
      const cx=cols(), sx=R-((R-L)<130?66:78); ensure(32,false);
      const line=(a,b)=>{ fnt("normal",FS); col(INK); txt(a,sx,y); txt(b,cx.ges,y,{align:"right"}); y+=RH()+.6; };
      if(c.rab){ line("Summe Positionen",eur(c.sum)); line(`Rabatt (${numIn(r.rabatt)} %)`,"− "+eur(c.rab)); }
      if(c.p){ line("Zwischensumme (netto)",eur(c.netto)); line(`MwSt. (${numIn(c.p)} %)`,eur(c.mwst)); }
      y+=1; const lbl=c.p?"Gesamtbetrag (brutto)":"Gesamtbetrag";
      if(CFG.total==="fill"){ doc.setFillColor(...ACC); doc.roundedRect(sx-3,y-1,cx.ges-sx+4.5,10,1.5,1.5,"F"); fnt("bold",FS+2.5); col(WHITE); txt(lbl,sx,y+5.8); txt(eur(c.brutto),cx.ges,y+5.8,{align:"right"}); y+=17; }
      else { doc.setDrawColor(...CFG.totalLine); doc.setLineWidth(CFG.totalLine===LINE?.25:.5); doc.line(sx,y,cx.ges,y); y+=6; fnt("bold",FS+2.5); col(INK); txt(lbl,sx,y); col(CFG.totalCol); txt(eur(c.brutto),cx.ges,y,{align:"right"}); y+=lay==="kompakt"?9:12; }
      col(INK); fnt("normal",FS);
    }
    function intro(){ fnt("normal",FS); col(INK); ensure(14,false); txt(X.anrede,L,y); y+=RH(); const ls=doc.splitTextToSize(X.intro,R-L); txt(ls,L,y); y+=ls.length*RH()+RH()*.9; }
    function deviceLine(){ if(!r.geraet) return; fnt("normal",FS); col(GREY); const ls=doc.splitTextToSize(`Gerät: ${r.geraet}${r.imei?"  ·  IMEI/SN "+r.imei:""}`,R-L); txt(ls,L,y); col(INK); y+=ls.length*RH()+1; }
    function deviceBox(){
      if(!D.devItems.length && !D.problem) return;
      const colW=(R-L-8)/3, rows=Math.ceil(D.devItems.length/3);
      fnt("normal",FS-.5); const pl = D.problem ? doc.splitTextToSize(D.problem,R-L-8) : [];
      const h = 4 + rows*9.5 + (pl.length ? 6+pl.length*lh(FS-.5)*1.18 : 0) + 1;
      doc.setFillColor(250,251,252); doc.setDrawColor(...LINE); doc.setLineWidth(.25); doc.roundedRect(L,y,R-L,h,1.5,1.5,"FD"); doc.setFillColor(...ACC); doc.rect(L,y,1.3,h,"F");
      let yy=y+5;
      D.devItems.forEach(([a,b],i)=>{ const x=L+4+(i%3)*colW, ry=yy+Math.floor(i/3)*9.5; fnt("bold",6.3); col(GREY); txt(a.toUpperCase(),x,ry,{charSpace:.3}); fnt("bold",FS-.5); col(INK); txt(doc.splitTextToSize(String(b),colW-3)[0],x,ry+4.2); });
      yy+=rows*9.5;
      if(pl.length){ doc.setDrawColor(...LINE); doc.line(L+4,yy-3,R-4,yy-3); fnt("bold",6.3); col(GREY); txt("FEHLERBESCHREIBUNG",L+4,yy+1,{charSpace:.3}); fnt("normal",FS-.5); col(INK); txt(pl,L+4,yy+5.2); }
      y+=h+5; col(INK);
    }
    function notesGreet(){
      const arr=[...(X.klein?["Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."]:[]), ...(X.pay?[X.pay]:[]), ...(r.notiz?[...(X.pay?[""]:[]), r.notiz]:[])];
      fnt("normal",FS); col(INK);
      arr.forEach(n=>{ const ls=n?doc.splitTextToSize(n,R-L):[""]; ensure(ls.length*RH(),false); txt(ls,L,y); y+=ls.length*RH(); });
      y += lay==="kompakt"?5:8; ensure(12,false); txt("Mit freundlichen Grüßen",L,y); fnt("bold",FS); txt(f.name||"",L,y+RH()+1.5); fnt("normal",FS);
    }

    // ---- page 1 head, per layout
    pageDeco(true);
    if(["modern","werkstatt","din","kompakt"].includes(lay)){
      const P={modern:{top:12,lw:72,lh:24,sendY:52,addrY:57,metaX:128,metaY:54,titleY:94,tfs:13}, werkstatt:{top:12,lw:72,lh:24,sendY:52,addrY:57,metaX:128,metaY:54,titleY:94,tfs:13},
               din:{top:9,lw:75,lh:28,sendY:58,addrY:63,metaX:125,metaY:55,titleY:102,tfs:12}, kompakt:{top:9,lw:56,lh:17,sendY:34,addrY:39,metaX:140,metaY:36,titleY:66,tfs:11}}[lay];
      logoAt(L,P.top,P.lw,P.lh,false);
      lines(contactLines,R,P.top+3,FS-1,GREY,{align:"right",boldFirst:true,firstCol:INK});
      senderLine(L,P.sendY); lines(D.addr,L,P.addrY,FS+1,INK);
      metaAt(P.metaX,R,P.metaY,FS-.5,lay==="din"?INK:NAVY,INK);
      y=P.titleY; fnt("bold",P.tfs); col(lay==="din"?INK:NAVY); txt(`${T.up} ${nrTxt}`,L,y); y+=RH()+2;
      if(lay==="werkstatt"){ y+=1; deviceBox(); } else deviceLine();
      y+=RH()*.8;
    } else if(lay==="minimal"){
      logoAt(L,16,44,13,false);
      fnt("normal",7.5); col(GREY); txt(doc.splitTextToSize(D.sender,90),R,20,{align:"right"});
      fnt("bold",8); col(GREY); txt(`${T.up}  ·  ${nrTxt}`,L,46,{charSpace:.4});
      fnt("bold",28); col(INK); txt(eur(c.brutto),L,59);
      fnt("normal",10); col(t==="rechnung"&&dStatus(r)==="bezahlt"?[29,125,69]:GREY); txt(D.due,L,66);
      metaAt(128,R,46,8.5,GREY,INK);
      doc.setDrawColor(...LINE); doc.setLineWidth(.25); doc.line(L,73,R,73);
      fnt("bold",6.8); col(GREY); txt("AN",L,82,{charSpace:.8}); txt("VON",112,82,{charSpace:.8});
      const ya=lines(D.addr.length?D.addr:["—"],L,88,FS+.5,INK), yb=lines(contactLines,112,88,FS-.5,INK,{boldFirst:true});
      y=Math.max(ya,yb)+8; deviceLine(); y+=2;
    } else if(lay==="block"){
      logoAt(L+2.5,13,62,18,true);
      fnt("bold",20); col(WHITE); txt(T.up,R,21,{align:"right",charSpace:.5});
      fnt("normal",11); txt(nrTxt,R,28.5,{align:"right"});
      fnt("normal",8.5); txt(`${D.meta[0][0]}: ${D.meta[0][1]}   ·   ${D.meta[1][0]}: ${D.meta[1][1]}`,R,36,{align:"right"});
      senderLine(L,56); lines(D.addr,L,61,FS+1,INK);
      const yc=lines(contactLines,R,58,FS-1,GREY,{align:"right",boldFirst:true,firstCol:INK});
      fnt("normal",FS-1); col(GREY); txt(`Leistungsdatum: ${D.meta[2][1]}`,R,yc+3,{align:"right"});
      y=Math.max(92,yc+12); deviceLine(); y+=2;
    } else if(lay==="side"){
      const x=10, w=SW-20; let yy=16;
      const lg=logoAt(x+2.5,yy,w-5,18,true); yy+=lg.h+12;
      fnt("bold",9.5); col(INK); const nm=doc.splitTextToSize(f.name||"",w); txt(nm,x,yy); yy+=nm.length*4.2+1;
      fnt("normal",8); [...D.firm, f.tel&&"Tel. "+f.tel, f.mail].filter(Boolean).forEach(s=>{ const ls=doc.splitTextToSize(s,w); txt(ls,x,yy); yy+=ls.length*3.6; });
      const sec=(title,arr)=>{ if(!arr.length) return; yy+=6; fnt("bold",6.8); col(ACC); txt(title,x,yy,{charSpace:.6}); yy+=4.2; fnt("normal",8); col(INK); arr.forEach(s=>{ const ls=doc.splitTextToSize(s,w); txt(ls,x,yy); yy+=ls.length*3.6; }); };
      sec("BANKVERBINDUNG",bankLines); sec("STEUER",taxLines);
      yy+=6; fnt("bold",6.8); col(ACC); txt(T.l.toUpperCase(),x,yy,{charSpace:.6}); yy+=4.5;
      D.meta.forEach(([a,b])=>{ fnt("normal",7.2); col(GREY); txt(a,x,yy); yy+=3.6; fnt("bold",8.5); col(INK); txt(b,x,yy); yy+=5; });
      fnt("bold",6.8); col(GREY); txt(t==="rechnung"?"RECHNUNG AN":"FÜR",L,24,{charSpace:.6});
      lines(D.addr.length?D.addr:["—"],L,30,FS+1.5,INK);
      y=70; fnt("bold",16); col(NAVY); txt(T.up,L,y); fnt("normal",11); col(ACC); txt(nrTxt,L,y+6.5); y+=15;
      deviceLine();
    }
    if(lay==="neutral"){
      const N=neutralData(r,D), BLUE=[41,170,225], FS2=8.3;
      try{ const src=docLogo(), p=doc.getImageProperties(src), ra=p.width/p.height; let w=78,h=w/ra; if(h>24){h=24;w=h*ra;} doc.addImage(src, src.startsWith("data:image/png")?"PNG":"JPEG", (210-w)/2, 13, w, h); }
      catch(e){ fnt("bold",18); col(NAVY); txt(f.name||"",105,24,{align:"center"}); }
      // sender line with arrows
      let x=L; const ys=57; fnt("bold",6.3); col(INK);
      N.senderParts.forEach((pt,i)=>{ txt(pt,x,ys); x+=doc.getTextWidth(pt)+1.8;
        if(i<N.senderParts.length-1){ doc.setDrawColor(...INK); doc.setLineWidth(.2); doc.line(x,ys-.8,x+2.6,ys-.8); doc.line(x+1.8,ys-1.5,x+2.6,ys-.8); doc.line(x+1.8,ys-.1,x+2.6,ys-.8); x+=4.4; } });
      lines(D.addr,L,63.5,9,INK);
      N.meta.forEach(([a,b],i)=>{ const yy=57.5+i*4.5; fnt("normal",5.9); col([74,79,87]); txt(a.toUpperCase(),120,yy,{charSpace:.35}); fnt("bold",7.2); col(INK); txt(b,155,yy); });
      y=100; fnt("bold",13); col(INK); txt(`${T.l} Nr. ${nrTxt}`,L,y); fnt("normal",8.5); txt(deDate(r.datum),R-2,y,{align:"right"});
      y+=8; fnt("normal",FS2); txt(N.leist,L,y); y+=4.2;
      if(r.geraet){ txt(`Gerät: ${r.geraet}${r.imei?"  ·  IMEI/SN "+r.imei:""}`,L,y); y+=4.2; }
      y+=2.5;
      const cM=128, cE=158, cG=R-2, dw=(cM-24)-(L+10);
      const nhead=()=>{ doc.setFillColor(228,228,228); doc.rect(L,y,R-L,7.5,"F"); fnt("bold",FS2); col(INK); txt("Beschreibung",L+2.5,y+5); txt("Menge",cM,y+5,{align:"right"}); txt("Einzelpreis",cE,y+5,{align:"right"}); txt("Gesamtpreis",cG,y+5,{align:"right"}); y+=7.5; };
      nhead();
      r.positionen.forEach((p,i)=>{ fnt("normal",FS2); const ls=doc.splitTextToSize(p.bez||"",dw); const h=ls.length*3.7+4.6;
        if(y+h>bottom){ doc.addPage(); pageDeco(false); y=20; nhead(); }
        if(i%2===1){ doc.setFillColor(241,241,241); doc.rect(L,y,R-L,h,"F"); }
        col(INK); txt(`${i+1}.`,L+2.5,y+4.6); txt(ls,L+10,y+4.6); txt(`${qtyTxt(p.menge)} ${p.einheit||"Stk."}`,cM,y+4.6,{align:"right"}); txt(eurTxt(p.preis),cE,y+4.6,{align:"right"}); txt(eurTxt(p.menge*p.preis),cG,y+4.6,{align:"right"}); y+=h; });
      const trow=(a,b,fill,bold)=>{ if(y+7.5>bottom){ doc.addPage(); pageDeco(false); y=20; } if(fill){ doc.setFillColor(236,236,236); doc.rect(L,y,R-L,7,"F"); } fnt("normal",FS2); col(INK); txt(a,L+2.5,y+4.7); if(b){ fnt(bold?"bold":"normal",FS2); txt(b,cG,y+4.7,{align:"right"}); } y+=7; };
      if(c.rab){ trow("Summe Positionen",eurTxt(c.sum),false); trow(`Rabatt (${numIn(r.rabatt)} %)`,"− "+eurTxt(c.rab),false); }
      trow("Gesamtbetrag netto",eurTxt(c.netto),true);
      if(c.p) trow(`zzgl. Umsatzsteuer ${numIn(c.p)} %`,eurTxt(c.mwst),false); else trow(dKu(r)?"Umsatzsteuer nicht erhoben gemäß § 19 UStG.":"Umsatzsteuer 0 %","",false);
      trow("Gesamtbetrag brutto",eurTxt(c.brutto),true,true);
      y+=9; fnt("normal",FS2); col(INK);
      [X.pay, r.notiz, N.thanks].filter(Boolean).forEach(pp=>{ const ls=doc.splitTextToSize(pp,R-L); if(y+ls.length*3.8>bottom){ doc.addPage(); pageDeco(false); y=20; } txt(ls,L,y); y+=ls.length*3.8+3; });
      y+=1.5; if(y+8>bottom){ doc.addPage(); pageDeco(false); y=20; } txt("Mit freundlichen Grüßen",L,y); y+=3.9; fnt("bold",FS2);
      if(N.nm){ col(INK); txt(N.nm[1],L,y); col(BLUE); txt(N.nm[2],L+doc.getTextWidth(N.nm[1]),y); } else { col(INK); txt(f.name||"",L,y); }
      col(INK);
    } else { intro(); positions(); y+=2; totals(); notesGreet(); }

    // ---- every page: stamp, liability note, footer
    const pages=doc.getNumberOfPages();
    for(let pg=1; pg<=pages; pg++){ doc.setPage(pg); const fy=CFG.foot;
      if(X.stamp && pg===1){ try{ doc.saveGraphicsState(); doc.setGState(new doc.GState({opacity:.28})); doc.setTextColor(29,125,69); fnt("bold",46); txt("BEZAHLT",lay==="side"?122:118,CFG.stampY,{angle:14}); fnt("bold",13); if(r.bezahltAm) txt(`am ${deDate(r.bezahltAm)}`,lay==="side"?136:132,CFG.stampY+4,{angle:14}); doc.restoreGraphicsState(); }catch(e){} }
      if(haftLines.length){ fnt("normal",7); col(GREY); txt(haftLines,L,(lay==="side"?fy-2:fy-7)-(haftLines.length-1)*3.2); }
      if(lay==="neutral"){
        doc.setDrawColor(213,217,223); doc.setLineWidth(.2); doc.line(L,fy-4,R,fy-4);
        const cols=[[["",f.name],["",f.strasse],["",[f.plz,f.ort].filter(Boolean).join(" ")]],[["TEL",f.tel],["MAIL",f.mail]],[["BANK",f.bank],["IBAN",f.iban],["BIC",f.bic]],[["ST.-NR.",f.stnr],["UST-ID",f.ustid]]]
          .map(cl=>cl.filter(x=>x[1])).filter(cl=>cl.length);
        const xs=[L, L+40, L+80, L+134];
        cols.forEach((cl,ci)=>cl.forEach(([a,b],i)=>{ const yy=fy+i*3.4; let x=xs[ci]||xs[3];
          if(a){ fnt("normal",5.4); col([107,112,121]); txt(a,x,yy,{charSpace:.3}); x+= ci===3?11:9; }
          fnt("bold",6.6); col(INK); txt(b,x,yy); }));
      } else if(lay!=="side"){
        doc.setDrawColor(...(lay==="minimal"?LINE:GREY)); doc.setLineWidth(.2); doc.line(L,fy-4,R,fy-4); fnt("normal",7.3); col(GREY);
        const cw=(R-L)/3;
        [[f.name,...D.firm],bankLines,[f.tel&&"Tel. "+f.tel,...taxLines].filter(Boolean)].forEach((cl,ci)=>cl.filter(Boolean).forEach((s,i)=>txt(s,L+ci*cw,fy+i*3.4)));
      }
      fnt("normal",7.3); col(GREY); txt(`Seite ${pg} von ${pages} · ${T.l} ${nrTxt}`,lay==="side"?(L+R)/2:105,293,{align:"center"}); col(INK);
    }
    return doc;
  }

  /* ---------- Kunden ---------- */
  function openKunde(id){
    const k=id?kunde(id):null; if(k) pushRecent("kunde",id); const jobs=k?S.auftraege.filter(a=>a.kundeId===k.id):[]; const docs=k?S.rechnungen.filter(r=>r.kundeId===k.id):[];
    const fld=(i,l,v,ph="",type="text")=>`<div class="field"><label for="${i}">${l}</label><input id="${i}" type="${type}" placeholder="${ph}" value="${esc(v)}"></div>`;
    openSheet(k?"Kunde":"Neuer Kunde", `
      <div class="group"><span class="glabel">Kontakt</span><div class="box">${fld("kName","Name",k?.name,"Vor- und Nachname")}${fld("kFirma","Firma",k?.firma,"optional")}${fld("kTel","Telefon",k?.tel,"optional","tel")}${fld("kMail","E-Mail",k?.mail,"optional","email")}${fld("kNr","Kunden-Nr.",k?.nr||"",k?kundenNr(k):nextKundenNr())}</div></div>
      <div class="group"><span class="glabel">Adresse (für die Rechnung)</span><div class="box">${fld("kStr","Straße, Nr.",k?.strasse,"optional")}<div class="two">${fld("kPlz","PLZ",k?.plz,"")}${fld("kOrt","Ort",k?.ort,"")}</div>${fld("kLand","Land",k?.land,"optional, z. B. Deutschland")}</div></div>
      ${jobs.length?`<div class="group"><span class="glabel">Aufträge</span>${jobs.map(jobCard).join("")}</div>`:""}
      ${docs.length?`<div class="group"><span class="glabel">Rechnungen &amp; Angebote</span>${docs.map(docCard).join("")}</div>`:""}
      ${k?`<button class="btn danger" id="delK">Kunde löschen</button><div id="delConfirm"></div>`:""}`, () => {
        const name=val("kName"); if(!name){ toast("Bitte einen Namen eintragen"); $("#kName").focus(); return false; }
        save("kunden",{...(k||{id:uid(),created:today()}), nr:val("kNr")||(k?kundenNr(k):nextKundenNr()), name, firma:val("kFirma"), tel:val("kTel"), mail:val("kMail"), strasse:val("kStr"), plz:val("kPlz"), ort:val("kOrt"), land:val("kLand")}); toast(k?"Kunde gespeichert":"Kunde angelegt"); });
    $$("#sBody [data-job]").forEach(b=>b.onclick=()=>openJobDetail(b.dataset.job));
    $$("#sBody [data-doc]").forEach(b=>b.onclick=()=>openDoc(b.dataset.doc));
    const d=$("#delK"); if(d) d.onclick=()=>confirmBox(`${esc(k.name)} löschen?${jobs.length?` ${jobs.length} Auftrag/Aufträge bleiben ohne Kunde.`:""}`, ()=>{ remove("kunden",k.id); closeSheet(); toast("Kunde gelöscht"); });
  }

  /* ---------- Ersatzteile ---------- */
  function openTeil(id){
    const t=id?S.teile.find(x=>x.id===id):null;
    openSheet(t?"Produkt":"Neues Produkt", `<div class="group"><span class="glabel">Pflichtfeld</span><div class="box"><div class="field stack"><label for="tBez">Bezeichnung</label><input id="tBez" placeholder="z. B. Display iPhone 13 Pro (OLED)" value="${esc(t?.bez)}"></div></div></div>
      <div class="group"><span class="glabel">Details</span><div class="box">
        <div class="field"><label for="tKat">Kategorie</label><select id="tKat">${["Artikel","Dienstleistung"].map(x=>`<option ${(t?.kategorie||"Artikel")===x?"selected":""}>${x}</option>`).join("")}</select></div>
        <div class="field"><label for="tEinh">Einheit</label><select id="tEinh">${einhOpts(t?.einheit||"Stk.")}</select></div>
        <div class="field"><label for="tArt">Artikelnr.</label><input id="tArt" class="mono" placeholder="optional" value="${esc(t?.artnr)}"></div>
        <div class="field"><label for="tPreis">Verkaufspreis €</label><input id="tPreis" inputmode="decimal" placeholder="0,00" value="${numIn(t?.preis)}"></div>
        <div class="field"><label for="tEk">Einkaufspreis €</label><input id="tEk" inputmode="decimal" placeholder="optional" value="${numIn(t?.ek)}"></div>
        <div class="field"><label for="tBest">Bestand (Stk.)</label><input id="tBest" inputmode="numeric" placeholder="0" value="${numIn(t?.bestand)}"></div>
        <div class="field"><label for="tLager">Lagerort</label><input id="tLager" placeholder="optional, z. B. Schublade 2" value="${esc(t?.lager)}"></div></div>
        <p class="help">Wird ein Teil in eine Rechnung übernommen, sinkt der Bestand automatisch.</p></div>
      ${t?`<button class="btn danger" id="delT">Ersatzteil löschen</button>`:""}`, () => {
        const bez=val("tBez"); if(!bez){ toast("Bitte eine Bezeichnung eintragen"); $("#tBez").focus(); return false; }
        save("teile",{...(t||{id:uid()}), bez, artnr:val("tArt"), preis:parseNum(val("tPreis")), ek:val("tEk")?parseNum(val("tEk")):"", bestand:parseNum(val("tBest")), lager:val("tLager"), kategorie:val("tKat")||"Artikel", einheit:val("tEinh")||"Stk."}); toast("Produkt gespeichert"); });
    const d=$("#delT"); if(d) d.onclick=()=>{ remove("teile",t.id); closeSheet(); toast("Ersatzteil gelöscht"); };
  }

  /* ---------- Textbausteine ---------- */
  function openTexte(){
    const f=S.firma;
    const box=(id,label,help)=>`<div class="sec"><h4>${ico.text}<span class="sp">${label}</span><button type="button" class="linkbtn" data-suggest="${id}">Vorschlag einfügen</button></h4>
      <textarea id="x_${id}" class="input" rows="5" placeholder="${esc(TEXT_SUGGEST[id])}">${esc(f[id]||"")}</textarea><p class="help" style="margin:0">${help}</p></div>`;
    openSheet("Textbausteine", `
      <p class="help">Diese Texte werden automatisch in neue Belege übernommen. Im einzelnen Beleg können Sie sie jederzeit anpassen.</p>
      ${box("textRechnung","Hinweis auf Rechnungen","Steht unter dem Gesamtbetrag, z. B. Garantie-Bestimmungen.")}
      ${box("textAngebot","Hinweis auf Angeboten & KVA","Z. B. Reparaturdauer, Lieferzeit von Ersatzteilen.")}
      ${box("haftung","Haftungsausschluss","Erscheint klein unten auf jedem Beleg (Rechnung, Angebot, KVA).")}
      <p class="help">Die Vorschläge sind Formulierungshilfen und keine Rechtsberatung. Lassen Sie Garantie- und Haftungstexte im Zweifel kurz von einem Anwalt oder der Handwerkskammer prüfen.</p>`, () => {
        setFirma({textRechnung:$("#x_textRechnung").value.trim(), textAngebot:$("#x_textAngebot").value.trim(), haftung:$("#x_haftung").value.trim()}); toast("Textbausteine gespeichert"); });
    $$("[data-suggest]").forEach(b=>b.onclick=()=>{ const ta=$("#x_"+b.dataset.suggest); ta.value=TEXT_SUGGEST[b.dataset.suggest]; ta.focus(); });
  }

  /* ---------- Firma ---------- */
  function prepareLogo(dataUrl, done){
    // trims white/transparent margins and scales for crisp, compact storage
    const img=new Image();
    img.onload=()=>{
      const s0=Math.min(1,1400/img.width,1400/img.height); const w0=Math.max(1,Math.round(img.width*s0)), h0=Math.max(1,Math.round(img.height*s0));
      const c0=document.createElement("canvas"); c0.width=w0; c0.height=h0; const x0=c0.getContext("2d");
      x0.fillStyle="#fff"; x0.fillRect(0,0,w0,h0); x0.drawImage(img,0,0,w0,h0);
      let minX=w0,minY=h0,maxX=-1,maxY=-1;
      try{ const px=x0.getImageData(0,0,w0,h0).data;
        for(let y=0;y<h0;y++) for(let x=0;x<w0;x++){ const i=(y*w0+x)*4; if(Math.min(px[i],px[i+1],px[i+2])<235){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; } } }catch(e){}
      if(maxX<0){ minX=0; minY=0; maxX=w0-1; maxY=h0-1; }
      const padPx=Math.round(Math.max(maxX-minX,maxY-minY)*.03);
      minX=Math.max(0,minX-padPx); minY=Math.max(0,minY-padPx); maxX=Math.min(w0-1,maxX+padPx); maxY=Math.min(h0-1,maxY+padPx);
      const cw=maxX-minX+1, ch=maxY-minY+1, s=Math.min(1,900/cw,300/ch);
      const c=document.createElement("canvas"); c.width=Math.round(cw*s); c.height=Math.round(ch*s); const x=c.getContext("2d");
      x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); x.imageSmoothingQuality="high"; x.drawImage(c0,minX,minY,cw,ch,0,0,c.width,c.height);
      done(c.toDataURL("image/jpeg",.9));
    };
    img.onerror=()=>toast("Bild konnte nicht gelesen werden");
    img.src=dataUrl;
  }
  function openFirma(){
    const f=S.firma; let logo=f.logo||"";
    const fld=(i,l,v,ph="",cls="")=>`<div class="field"><label for="${i}">${l}</label><input id="${i}" class="${cls}" placeholder="${ph}" value="${esc(v)}"></div>`;
    openSheet("Firmendaten", `
      <p class="help">Diese Daten erscheinen auf Ihren Rechnungen, Angeboten und PDFs.</p>
      <div class="group"><span class="glabel">Firma</span><div class="box">${fld("cName","Firmenname",f.name,"RepairMobile")}${fld("cStr","Straße",f.strasse,"Musterstraße 1")}<div class="two">${fld("cPlz","PLZ",f.plz,"12345")}${fld("cOrt","Ort",f.ort,"Musterstadt")}</div>${fld("cTel","Telefon",f.tel,"+49 …")}${fld("cMail","E-Mail",f.mail,"info@…")}${fld("cAnsp","Ansprechpartner",f.ansprechpartner,"Vor- und Nachname")}</div></div>
      <div class="group"><span class="glabel">Logo</span><div class="box"><div class="logoprev" id="lPrev"><img src="${logo||""}" alt="Logo" ${logo?"":"hidden"}><span style="color:var(--muted);font-size:13px" id="lInfo">${logo?"Eigenes Logo":"Kein Logo – auf den Belegen steht dann Ihr Firmenname"}</span></div>
        <div class="field"><label for="cLogo">Neues Logo</label><input type="file" id="cLogo" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="text-align:left"></div>
        ${logo?`<div class="field"><button type="button" class="btn ghost sm" id="cLogoDel">Logo entfernen</button></div>`:""}</div>
        <p class="help">PNG oder JPG. Weiße Ränder werden automatisch abgeschnitten, damit das Logo oben links auf dem Beleg so groß wie möglich und unverzerrt erscheint.</p></div>
      <div class="group"><span class="glabel">Bankverbindung</span><div class="box">${fld("cBank","Bank",f.bank,"z. B. Sparkasse")}${fld("cIban","IBAN",f.iban,"DE00 0000 0000 0000 0000 00","mono")}${fld("cBic","BIC",f.bic,"optional","mono")}</div></div>
      <div class="group"><span class="glabel">Steuer</span><div class="box">${fld("cStnr","Steuernummer",f.stnr,"123/456/78901","mono")}${fld("cUst","USt-IdNr.",f.ustid,"optional","mono")}
        <div class="field"><label for="cKlein">Kleinunternehmer</label><input type="checkbox" class="toggle" id="cKlein" ${f.kleinunternehmer?"checked":""}></div>
        <div class="field"><label for="cNetto">Preise netto eingeben</label><input type="checkbox" class="toggle" id="cNetto" ${f.netto?"checked":""}></div></div>
        <p class="help">Kleinunternehmer an: neue Belege ohne MwSt., mit Hinweis auf § 19 UStG. „Preise netto“ an: MwSt. wird auf Ihre Preise aufgeschlagen (sonst sind die Preise Endpreise inkl. MwSt.).</p></div>
      <div class="group"><span class="glabel">Nummernkreise</span><div class="box">
        <div class="field"><label for="cPreJob">Aufträge</label><input id="cPreJob" class="mono" maxlength="12" autocapitalize="characters" placeholder="JOB-" value="${esc(f.preJob??"")}"></div>
        <div class="field"><label for="cPreRe">Rechnungen</label><input id="cPreRe" class="mono" maxlength="12" autocapitalize="characters" placeholder="RE-" value="${esc(f.preRe??"")}"></div>
        <div class="field"><label for="cPreAn">Angebote</label><input id="cPreAn" class="mono" maxlength="12" autocapitalize="characters" placeholder="AN-" value="${esc(f.preAn??"")}"></div>
        <div class="field"><label for="cPreKv">Kostenvoranschläge</label><input id="cPreKv" class="mono" maxlength="12" autocapitalize="characters" placeholder="KV-" value="${esc(f.preKv??"")}"></div>
        <div class="field"><label for="cNrJahr">Jahreszahl in Belegnummer</label><input type="checkbox" class="toggle" id="cNrJahr" ${f.nrJahr!==false?"checked":""}></div>
        <div class="kv" style="flex-direction:column;gap:6px"><span>Nächste Nummern</span><div id="nrPrev" class="mono"></div></div></div>
        <p class="help">Leer lassen = Standard. Bestehende Aufträge und Belege behalten ihre Nummer. Die laufende Nummer zählt einfach weiter, auch wenn Sie ein Kürzel ändern. Mit Jahreszahl beginnt jedes neue Jahr wieder bei 0001.</p></div>
      <div class="group" id="grpKi"><span class="glabel">KI-Belegerkennung (Google Gemini)</span><div class="box">
        <div class="field"><label for="cGemini">Gemini API-Key</label><input id="cGemini" type="password" class="mono" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="AIza…" value="${esc(f.geminiApiKey||"")}"><button type="button" class="eyebtn" id="cGemEye" aria-label="Key anzeigen">${ico.eye}</button></div>
        <div class="field"><label for="cGemModel">Modell</label><input id="cGemModel" class="mono" list="gemModels" autocapitalize="off" spellcheck="false" placeholder="automatisch" value="${esc(f.geminiModel||"")}"><datalist id="gemModels"></datalist></div>
        <div class="field gemtest"><button type="button" class="btn ghost sm" id="cGemTest">Verbindung testen</button><span id="cGemRes"></span></div>
        <div class="gemsteps" id="cGemSteps" hidden></div></div>
        <p class="help">Mit Key liest die KI beim Erfassen einer Ausgabe Händler, Datum, Rechnungs-Nr., Betrag und MwSt. aus. Dazu wird das Foto bzw. die PDF an Google gesendet – im kostenlosen Tarif darf Google die Inhalte zur Verbesserung seiner Dienste verwenden. Ohne Key oder bei einem Fehler nutzt die App automatisch die lokale Texterkennung. Den Key erstellen Sie in Google AI Studio; er wird nicht ins Backup geschrieben. Modell leer lassen = automatisch: Die App fragt Google, welche Modelle Ihr Key nutzen darf, und weicht bei Überlastung, Limit oder Zeitüberschreitung selbst auf das nächste aus.</p></div>
      <div class="group"><span class="glabel">Standards</span><div class="box">
        <div class="field"><label for="cZiel">Zahlungsziel (Tage)</label><input id="cZiel" inputmode="numeric" value="${f.ziel??14}"></div>
        <div class="field"><label for="cPausch">Arbeitspauschale €</label><input id="cPausch" inputmode="decimal" value="${numIn(f.pauschale??39)}"></div></div></div>`, () => {
        saveFirma({...S.firma, name:val("cName"), strasse:val("cStr"), plz:val("cPlz"), ort:val("cOrt"), tel:val("cTel"), mail:val("cMail"), ansprechpartner:val("cAnsp"), bank:val("cBank"), iban:val("cIban").toUpperCase(), bic:val("cBic").toUpperCase(), stnr:val("cStnr"), ustid:val("cUst"), kleinunternehmer:$("#cKlein").checked, netto:$("#cNetto").checked, ziel:parseInt(val("cZiel"))||14, pauschale:parseNum(val("cPausch")), logo, geminiApiKey:val("cGemini"), geminiModel:val("cGemModel"), ...readNrForm()});
        toast("Firmendaten gespeichert"); });
    const nrUpd=()=>{ const f2={...S.firma, ...readNrForm()};
      $("#nrPrev").innerHTML=[["Auftrag",nextJobNrFor(f2)],["Rechnung",nextNr("rechnung",f2)],["Angebot",nextNr("angebot",f2)],["KVA",nextNr("kva",f2)]].map(([a,b])=>`<i>${a}</i><b>${esc(b)}</b>`).join(""); };
    ["cPreJob","cPreRe","cPreAn","cPreKv"].forEach(id=>$("#"+id).oninput=nrUpd); $("#cNrJahr").onchange=nrUpd; nrUpd();
    $("#cLogo").onchange=e=>{ const file=e.target.files[0]; if(!file) return; const rd=new FileReader(); rd.onload=()=>prepareLogo(rd.result, out=>{ logo=out; $("#lPrev img").hidden=false; $("#lPrev img").src=logo; $("#lInfo").textContent="Neues Logo – zum Übernehmen „Speichern“ tippen"; }); rd.readAsDataURL(file); };
    $("#cGemEye").onclick=()=>{ const i=$("#cGemini"); i.type = i.type==="password" ? "text" : "password"; };
    $("#cGemTest").onclick=async()=>{ const out=$("#cGemRes"), box=$("#cGemSteps"), btn=$("#cGemTest"), key=val("cGemini");
      if(!key){ out.className="bad"; out.textContent="Bitte zuerst einen Key eintragen"; return; }
      btn.disabled=true; out.className=""; out.innerHTML=`<span class="ocrspin" style="display:inline-block;vertical-align:-4px;width:16px;height:16px"></span> Teste …`;
      const draw=steps=>{ if(!$("#cGemSteps")) return; box.hidden=false; box.innerHTML=steps.map(x=>`<div class="${x.ok?"ok":"bad"}"><i>${x.ok?"✓":"✕"}</i><span><b>${esc(x.t)}</b><small>${esc(x.d)}</small></span></div>`).join(""); };
      const t=await geminiDiagnose(key, val("cGemModel"), draw); if(!$("#cGemRes")) return; btn.disabled=false;
      out.className=t.ok?"good":"bad"; out.textContent = t.ok ? `✓ Funktioniert (${t.model})` : "✕ Fehlgeschlagen – Details unten";
      if(t.models?.length) $("#gemModels").innerHTML=t.models.map(m=>`<option value="${esc(m)}">`).join(""); };
    const ld=$("#cLogoDel"); if(ld) ld.onclick=()=>{ logo=""; const im=$("#lPrev img"); im.hidden=true; im.removeAttribute("src"); $("#lInfo").textContent="Logo wird entfernt – zum Übernehmen „Speichern“ tippen"; ld.remove(); };
  }

  /* ---------- Beispiel ---------- */
  function loadExamples(){
    const k={id:uid(), nr:nextKundenNr(), name:"Carlo Wagner (Beispiel)", tel:"0151 23456789", strasse:"Lindenweg 4", plz:"12345", ort:"Musterstadt", created:today()};
    save("kunden",k);
    const t={id:uid(), bez:"Display iPhone 13 Pro (OLED)", artnr:"DSP-13P", preis:189, bestand:3, lager:"Schublade 2"};
    save("teile",t);
    const a1={id:uid(), nr:nextJobNr(), created:today(), geraet:"iPhone 13 Pro – Display (Beispiel)", problem:"Display gesprungen, Touch reagiert unten nicht.", imei:"35 291611 482736 4", zubehoer:"Hülle", kundeId:k.id, termin:today()+"T08:00", erledigt:"", status:"reparatur",
      positionen:[{bez:"Display iPhone 13 Pro (OLED) (DSP-13P)",menge:1,einheit:"Stk.",preis:189,teilId:t.id},{bez:"Arbeitszeit / Reparatur",menge:1,einheit:"psch.",preis:39}]};
    save("auftraege",a1);
    const a2={id:uid(), nr:nextJobNr(), created:today(), geraet:"Galaxy S22 – Akkutausch (Beispiel)", problem:"Akku hält keinen halben Tag.", kundeId:k.id, termin:addDays(today(),2)+"T14:30", erledigt:"", status:"angenommen", positionen:[{bez:"Akku Galaxy S22",menge:1,einheit:"Stk.",preis:69},{bez:"Arbeitszeit / Reparatur",menge:1,einheit:"psch.",preis:39}]};
    save("auftraege",a2);
    toast("Beispiel angelegt – zum Löschen Auftrag öffnen → Bearbeiten");
  }

  /* ---------- Downloads ---------- */
  async function saveFile(filename, blob, okMsg){
    const dl = await getDownloader();
    if(!dl){ toast("Speichern ist in dieser Ansicht nicht möglich"); return false; }
    try{ await dl.save({ filename, data: blob }); toast(okMsg); return true; }
    catch(e){ if(e && !["cancelled","declined","aborted"].includes(e.code)) toast("Datei konnte nicht gespeichert werden"); return false; }
  }

  /* ---------- CSV für den Steuerberater ---------- */
  function csvRows(){
    const pre = UI.csvYear + (UI.csvMonth ? "-"+UI.csvMonth : "");
    return S.rechnungen.filter(r=>dTyp(r)==="rechnung" && r.nr && dStatus(r)!=="entwurf" && (r.datum||"").startsWith(pre))
      .sort((a,b)=>(a.datum||"").localeCompare(b.datum||"") || (a.nr||"").localeCompare(b.nr||""));
  }
  function exportCsv(){
    const rows=csvRows(); if(!rows.length){ toast("Keine Rechnungen in diesem Zeitraum"); return; }
    exportDocsCsv(rows, UI.csvYear + (UI.csvMonth ? "-"+UI.csvMonth : ""));
  }

  /* ---------- Auswahl & Mehrfach-Löschen ---------- */
  const selWord = (kind,n) => kind==="kunden" ? (n===1?"Kontakt":"Kontakte") : kind==="teile" ? (n===1?"Produkt":"Produkte") : (n===1?"Beleg":"Belege");
  const isPicked = (kind,id) => UI.sel?.kind===kind && UI.sel.ids.has(id);
  const pickCircle = () => `<span class="pickc" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`;
  function pickWrap(kind, id, inner){
    if(UI.sel?.kind!==kind) return `<button class="card" data-${kind==="kunden"?"kunde":"teil"}="${id}">${inner}</button>`;
    return `<button class="card pickrow${isPicked(kind,id)?" picked":""}" data-pick="${id}" aria-pressed="${isPicked(kind,id)}">${pickCircle()}<div class="pickbody">${inner}</div></button>`;
  }
  function selBar(kind){
    if(UI.sel?.kind!==kind) return "";
    const n=UI.sel.ids.size, vis=UI.selVis[kind].map(x=>x.id), all=vis.length && vis.every(id=>UI.sel.ids.has(id));
    const word = selWord(kind, n);
    if(UI.sel.confirm){
      let extra="";
      if(kind==="kunden"){ const jobs=S.auftraege.filter(a=>UI.sel.ids.has(a.kundeId)).length, docs=S.rechnungen.filter(r=>UI.sel.ids.has(r.kundeId)).length;
        if(jobs||docs) extra=` ${[jobs?`${jobs} Auftr${jobs===1?"ag":"äge"}`:"", docs?`${docs} Beleg${docs===1?"":"e"}`:""].filter(Boolean).join(" und ")} bleiben erhalten, aber ohne Kunde.`; }
      else if(kind==="teile") extra=" Bereits erstellte Rechnungen bleiben unverändert.";
      else { const fin=S.rechnungen.filter(r=>UI.sel.ids.has(r.id) && dTyp(r)==="rechnung" && r.nr && !["entwurf","storniert"].includes(dStatus(r))).length;
        if(fin) extra=` Darunter ${fin} erstellte Rechnung${fin===1?"":"en"} – diese besser stornieren statt löschen (Aufbewahrungspflicht 10 Jahre).`; }
      return `<div class="selbar warn" role="alertdialog"><span class="n">${n} ${word} endgültig löschen?<small>${extra.trim()}</small></span><div class="btnrow"><button class="btn ghost sm" data-act="selNo">Abbrechen</button>${kind==="rechnungen" && extra ? `<button class="btn sm" data-act="selStorno">Stornieren</button>` : ""}<button class="btn danger sm" data-act="selYes">Löschen</button></div></div>`;
    }
    return `<div class="selbar"><button class="btn ghost sm" data-act="selAll">${all?"Keine":"Alle"} auswählen</button><span class="n">${n} ausgewählt</span><button class="btn danger sm" data-act="selDel" ${n?"":"disabled style='opacity:.45'"}>Löschen</button></div>`;
  }
  async function removeMany(coll, ids){
    const set=new Set(ids); S[coll]=S[coll].filter(x=>!set.has(x.id)); lsSave(); render(); ids.forEach(id=>cloudQueue(coll, id, null, true));
    if(mode==="db"){ for(const id of ids){ try{ await dbRefs[coll].doc(id).delete(); }catch(e){ toast("Löschen teilweise fehlgeschlagen – bitte erneut versuchen"); break; } } }
  }

  /* ---------- Kalender: Long-Press-Aktionen ---------- */
  let LP=null;
  function dayText(day){
    const ev=eventsOn(day), f=S.firma;
    const line=e=>{ const k=kunde(e.a.kundeId); return `${e.t?e.t+" Uhr – ":"• "}${e.a.geraet||"Gerät"} (${k?.name||"ohne Kunde"}${k?.tel?", "+k.tel:""}) · ${STATUS[e.a.status].l}`; };
    const grp=(kind,title)=>{ const l=ev.filter(e=>e.k===kind); return l.length?`${title}:\n${l.map(line).join("\n")}`:""; };
    return [`${f.name||"RepairMobile"} – ${longDate(day)}`, grp("t","Termine"), grp("r","Repariert"), grp("a","Abgeholt")].filter(Boolean).join("\n\n");
  }
  function copyText(text, okMsg){
    const fallback=()=>{ openSheet("Text kopieren", `<p class="help">Text ist markiert – jetzt <b>Kopieren</b> wählen.</p><textarea id="cpText" class="mailtext" readonly style="min-height:220px">${esc(text)}</textarea>`, null, "", {cancelLabel:"Fertig"});
      setTimeout(()=>{ const t=$("#cpText"); if(t){ t.focus(); t.select(); } }, 300); };
    try{ navigator.clipboard.writeText(text).then(()=>toast(okMsg), fallback); }catch(e){ fallback(); }
  }
  function dayMenu(day){
    const n=eventsOn(day).length;
    UI.calDay=day; if(UI.calMonth!==day.slice(0,7)) UI.calMonth=day.slice(0,7);
    $$("#main .day").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.day===day)));
    openPicker(longDate(day), [
      {label:"+ Neuer Termin an diesem Tag", sub:"Auftrag mit diesem Datum anlegen", v:"new"},
      {label:"Tagesaufträge als Text kopieren", sub: n ? `${n} Eintrag${n===1?"":"e"} – für WhatsApp oder E-Mail` : "Keine Einträge an diesem Tag", v:"copy"}
    ], o => {
      if(o.v==="new") return openAuftrag(null, day);
      if(!n){ toast("An diesem Tag ist nichts eingetragen"); return; }
      copyText(dayText(day), "Tagesübersicht kopiert");
    });
    render();
  }

  /* ---------- WhatsApp / SMS an Kunden ---------- */
  function intlPhone(tel){
    let t=String(tel||"").replace(/[^\d+]/g,"");
    if(t.startsWith("+")) t=t.slice(1); else if(t.startsWith("00")) t=t.slice(2); else if(t.startsWith("0")) t="49"+t.slice(1);
    return t.length>=8 ? t : "";
  }
  function readyText(a,k){
    const inv=S.rechnungen.filter(r=>r.auftragId===a.id && dTyp(r)==="rechnung" && r.nr && dStatus(r)!=="storniert").sort((x,y)=>(y.datum||"").localeCompare(x.datum||""))[0];
    const sum = inv ? calc(inv).brutto : sumPos(a.positionen);
    const dev = (a.geraet||"Gerät").split(/\s[–-]\s/)[0].trim();
    return `Hallo ${k?.name||""}, Ihr ${dev} ist fertig repariert und liegt zur Abholung bereit!${sum?` Betrag: ${eur(sum)}.`:""} Viele Grüße, ${S.firma.name||"RepairMobile"}`.replace("Hallo ,","Hallo,");
  }
  function msgButtons(a,k){
    const tel=intlPhone(k?.tel), txt=encodeURIComponent(readyText(a,k));
    const wa='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7s1.8 2.8 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.5-.3z"/></svg>';
    if(!tel) return `<div class="group"><span class="glabel">Kunde benachrichtigen</span><div class="btnrow"><span class="btn wa" aria-disabled="true">${wa} WhatsApp an Kunden</span></div><p class="help">Beim Kunden ist keine Handynummer hinterlegt.</p></div>`;
    return `<div class="group"><span class="glabel">Kunde benachrichtigen</span><div class="btnrow">
      <a class="btn wa" href="https://wa.me/${tel}?text=${txt}" target="_blank" rel="noopener">${wa} WhatsApp an Kunden</a>
      <a class="btn ghost" href="sms:+${tel}${/iPhone|iPad/.test(navigator.userAgent)?"&":"?"}body=${txt}">SMS</a></div>
      <p class="help">„Hallo ${esc(k.name)}, Ihr ${esc((a.geraet||"Gerät").split(/\s[–-]\s/)[0])} ist fertig repariert …“</p></div>`;
  }

  /* ---------- OCR-Engine: Tesseract.js (Fotos) + pdf.js (PDFs), läuft lokal im Browser ---------- */
  const OCR_CDN = {
    tess:"https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
    worker:"https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
    core:"https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
    pdf:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    pdfWorker:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
  };
  const OCR_SRC = new WeakMap();   // Beleg → Originaldatei (volle Auflösung fürs Auslesen)
  const SCRIPTS = {};
  function loadScript(src){
    return SCRIPTS[src] ||= new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.async=true;
      s.onload=()=>res(); s.onerror=()=>{ delete SCRIPTS[src]; s.remove(); rej(new Error("Skript nicht ladbar")); }; document.head.appendChild(s); });
  }
  const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error(msg)), ms))]);
  let OCR_W=null, OCR_LOG=null;
  function ocrWorker(){
    if(!OCR_W) OCR_W = withTimeout((async()=>{
      await loadScript(OCR_CDN.tess);
      if(!window.Tesseract?.createWorker) throw new Error("Tesseract fehlt");
      return await window.Tesseract.createWorker("deu", 1, { workerPath:OCR_CDN.worker, corePath:OCR_CDN.core, logger:m=>OCR_LOG?.(m) });
    })(), 120000, "Texterkennung lädt zu lange").catch(e=>{ OCR_W=null; throw e; });
    return OCR_W;
  }
  // Foto für die Erkennung vorbereiten: groß genug, Graustufen, etwas mehr Kontrast
  async function ocrCanvasFromImage(src){
    const url = typeof src==="string" ? src : URL.createObjectURL(src);
    try{
      const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
      const sc=Math.min(1, 2200/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement("canvas");
      c.width=Math.round(img.naturalWidth*sc); c.height=Math.round(img.naturalHeight*sc);
      const g=c.getContext("2d"); g.filter="grayscale(1) contrast(1.35)"; g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
      return c;
    } finally { if(typeof src!=="string") URL.revokeObjectURL(url); }
  }
  function dataUrlBytes(d){ const b=atob(d.split(",")[1]); const u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; }
  function pdfLines(items){
    const rows=[]; for(const it of items){ if(!it.str || !it.str.trim()) continue; const y=it.transform[5], x=it.transform[4];
      let r=rows.find(r=>Math.abs(r.y-y)<3); if(!r){ r={y, parts:[]}; rows.push(r); } r.parts.push({x, s:it.str}); }
    return rows.sort((a,b)=>b.y-a.y).map(r=>r.parts.sort((a,b)=>a.x-b.x).map(p=>p.s).join(" ").replace(/\s+/g," ").trim());
  }
  async function ocrPdf(dataUrl, prog){
    await withTimeout(loadScript(OCR_CDN.pdf), 30000, "PDF-Leser lädt nicht");
    const pdfjs=window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc=OCR_CDN.pdfWorker;
    const doc=await pdfjs.getDocument({data:dataUrlBytes(dataUrl)}).promise; let text="";
    for(let p=1;p<=Math.min(doc.numPages,3);p++){ const pg=await doc.getPage(p); text+=pdfLines((await pg.getTextContent()).items).join("\n")+"\n"; }
    if(text.replace(/\s/g,"").length>40){ prog?.(1, "PDF-Text gelesen"); return {text, quelle:"pdf"}; }
    // gescannte PDF ohne Textebene → Seite 1 als Bild auslesen
    const pg=await doc.getPage(1), vp=pg.getViewport({scale:2.2}), c=document.createElement("canvas");
    c.width=vp.width; c.height=vp.height; await pg.render({canvasContext:c.getContext("2d"), viewport:vp}).promise;
    return {text:await ocrRecognize(c, prog), quelle:"scan"};
  }
  async function ocrRecognize(canvas, prog){
    OCR_LOG = m => { if(!prog) return;
      if(m.status==="recognizing text") prog(.35+.65*(m.progress||0), "Text wird gelesen");
      else if(/load|initializ/i.test(m.status||"")) prog(.05+.3*(m.progress||0), /language|traineddata/i.test(m.status)?"Deutsch-Wörterbuch wird geladen":"Texterkennung wird geladen"); };
    const w=await ocrWorker();
    const r=await withTimeout(w.recognize(canvas), 120000, "Auslesen dauert zu lange");
    return r?.data?.text || "";
  }
  async function ocrBeleg(beleg, prog){
    if(beleg.typ==="application/pdf") return ocrPdf(beleg.data, prog);
    let c; try{ c=await ocrCanvasFromImage(OCR_SRC.get(beleg) || beleg.data); }catch(e){ c=await ocrCanvasFromImage(beleg.data); }
    return {text:await ocrRecognize(c, prog), quelle:"foto"};
  }

  /* ---------- Beleg-Texterkennung: Betrag, Datum, MwSt., Händler, Rechnungs-Nr. aus OCR-Text ---------- */
  const OCR_MON = {jan:1,januar:1,feb:2,februar:2,"mär":3,maer:3,mar:3,"märz":3,maerz:3,apr:4,april:4,mai:5,jun:6,juni:6,jul:7,juli:7,aug:8,august:8,sep:9,sept:9,september:9,okt:10,oktober:10,oct:10,nov:11,november:11,dez:12,dezember:12,dec:12};
  function ocrClean(t){ return String(t||"").replace(/\r/g,"").replace(/[‚„]/g,",").replace(/[€]/g," € ").replace(/[ \t]+/g," "); }
  // Geldbeträge in einer Zeile: 1.234,56 | 1234,56 | 12.50 | 12, 50 | -12,50
  function ocrMoney(line){
    const out=[]; const rx=/(^|[^\d,.])(-?\d{1,3}(?:[.\s']\d{3})+|-?\d+)\s?[,.]\s?(\d{2})(?![\d%])/g; let m;
    while((m=rx.exec(line))){ const whole=m[2].replace(/[.\s']/g,""); const v=parseFloat(whole+"."+m[3]); if(isFinite(v) && Math.abs(v)<1e6) out.push({v, i:m.index}); }
    return out;
  }
  const OCR_STRONG = /(gesamtbetrag|gesamt\s*betrag|gesamtsumme|zu\s*zahlen|zahlbetrag|endbetrag|endsumme|rechnungsbetrag|bruttobetrag|gesamt\s*brutto|brutto\s*gesamt|summe\s*brutto|total|gesamt|summe\s*eur|^\s*summe|betrag\s*eur)/i;
  const OCR_WEAK = /(summe|betrag|bar\b|ec[- ]?karte|kartenzahlung|girocard|visa|mastercard|maestro|paypal|bezahlt|zahlung)/i;
  const OCR_BAD = /(netto|mwst|ust\b|ust\.|umsatzsteuer|steuer|rückgeld|rueckgeld|zurück|wechselgeld|gegeben|rabatt|ersparnis|gespart|pfand|zwischensumme|subtotal|stk|x\s*\d|einzelpreis|ust-?id|tel\b|fax|iban|bic|plz)/i;
  const ocrKw = line => line.toLowerCase().replace(/rn/g,"m").replace(/nn/g,"mm").replace(/sunme|surnme/g,"summe").replace(/([a-zäöü])0|0([a-zäöü])/g,(m,a,b)=>a?a+"o":"o"+b).replace(/([a-zäöü])[1l|]([a-zäöü])/g,"$1l$2");
  function ocrAmount(text){
    const L=ocrClean(text).split("\n").map(s=>s.trim()).filter(Boolean);
    const cand=[];
    L.forEach((line,i)=>{
      const vals=ocrMoney(line).filter(x=>x.v>0);
      const kw=ocrKw(line); const strong=OCR_STRONG.test(kw), weak=OCR_WEAK.test(kw), bad=OCR_BAD.test(kw) && !/gesamt|zu\s*zahlen|endbetrag|rechnungsbetrag/i.test(kw);
      if(vals.length){ const v=vals[vals.length-1].v; let s=strong?10:weak?5:0; if(bad) s-=8; if(/€|eur/i.test(line)) s+=1; cand.push({v, s, i, line}); }
      else if(strong && !bad && L[i+1] && !OCR_BAD.test(ocrKw(L[i+1]))){ const nx=ocrMoney(L[i+1]).filter(x=>x.v>0); if(nx.length) cand.push({v:nx[nx.length-1].v, s:8, i, line:line+" "+L[i+1]}); }
    });
    if(!cand.length) return null;
    const good=cand.filter(c=>c.s>=8);
    if(good.length){
      // mehrere Summenzeilen: der höchste Betrag mit gutem Schlüsselwort (Gesamt > Zwischensumme), bei Gleichstand die späteste
      const best=good.reduce((a,b)=> b.v>a.v+0.001 ? b : (Math.abs(b.v-a.v)<0.001 && b.i>a.i ? b : a));
      return {v:r2(best.v), sicher:true, zeile:best.line};
    }
    const weak=cand.filter(c=>c.s>=5);
    if(weak.length){ const best=weak.reduce((a,b)=>b.v>=a.v?b:a); return {v:r2(best.v), sicher:false, zeile:best.line}; }
    const pool=cand.filter(c=>c.s>=0); if(!pool.length) return null;
    const best=pool.reduce((a,b)=>b.v>=a.v?b:a); return {v:r2(best.v), sicher:false, zeile:best.line};
  }
  function ocrDate(text, now=new Date()){
    const T=ocrClean(text); const L=T.split("\n");
    const maxD=new Date(now.getTime()+2*864e5), minY=now.getFullYear()-6;
    const mk=(d,m,y)=>{ y=+y; if(y<100) y+=2000; d=+d; m=+m; const dt=new Date(y,m-1,d,12); if(dt.getMonth()!==m-1 || dt.getDate()!==d || y<minY || dt>maxD) return null; return `${y}-${pad(m)}-${pad(d)}`; };
    const found=[];
    L.forEach((line,i)=>{
      const add=(iso)=>{ if(!iso) return; let s=0; if(/(rechnungs|beleg|kauf|liefer|leistungs)?datum|date|vom\b/i.test(line)) s+=5; if(/rechnungsdatum|belegdatum/i.test(line)) s+=3; if(/fällig|faellig|zahlbar|gültig|gueltig|mhd|bis\b|ablauf|geburts/i.test(line)) s-=8; if(/\d{1,2}:\d{2}/.test(line)) s+=2; found.push({iso,s,i}); };
      let m; const r1=/(?<!\d)(\d{1,2})\s?[.\/-]\s?(\d{1,2})\s?[.\/-]\s?(\d{4}|\d{2})(?!\d)/g;
      while((m=r1.exec(line))) add(mk(m[1],m[2],m[3]));
      const r2x=/(?<!\d)(20\d{2})-(\d{2})-(\d{2})(?!\d)/g; while((m=r2x.exec(line))) add(mk(m[3],m[2],m[1]));
      const r3=/(?<!\d)(\d{1,2})\.?\s+([A-Za-zäÄ]{3,9})\.?\s+(\d{4})/g; while((m=r3.exec(line))){ const mo=OCR_MON[m[2].toLowerCase()]; if(mo) add(mk(m[1],mo,m[3])); }
    });
    if(!found.length) return null;
    const best=found.reduce((a,b)=>b.s>a.s?b:a);
    return {iso:best.iso, sicher: best.s>=5 || new Set(found.map(f=>f.iso)).size===1};
  }
  function ocrSatz(text){
    const T=ocrClean(text).toLowerCase();
    const has=p=>new RegExp(`(?<![\\d,])${p}(?:[,.]0{1,2})?\\s?%`).test(T);
    const s19=has(19), s7=has(7);
    if(s19) return 19; if(s7) return 7;
    if(/§\s*19\s*ustg|ohne\s+(mwst|umsatzsteuer)|kleinunternehmer/.test(T)) return 0;
    return null;
  }
  /* Händler: Verkäufer > Briefkopf > bekannter Shop > Plattform */
  const OCR_PLATFORMS = ["Amazon","eBay","Ebay Kleinanzeigen","Kleinanzeigen","AliExpress","Alibaba","PayPal","Etsy","Temu","Wish","Back Market","refurbed","Otto","Kaufland","Shopify","Klarna"];
  const OCR_KNOWN = ["Dr. SmartPHONE","Mobilesentrix","iFixit","Conrad","Reichelt","Mouser","Digi-Key","DigiKey","Farnell","RS Components","Pollin","Völkner","Voelkner","Alternate","Cyberport","Notebooksbilliger","Mindfactory","Hornbach","OBI","Bauhaus","Toom","Hagebau","MediaMarkt","Media Markt","Saturn","Würth","Lidl","Aldi","Rewe","Edeka","Netto","Penny","Rossmann","Aral","Shell","Esso","Telekom","Vodafone","Ikea","Staples","Apple","Samsung","Deutsche Post","DHL","Hermes","DPD","GLS","UPS"];
  const OCR_LEGAL = /\b(gmbh(?:\s*&\s*co\.?\s*kg)?|ag|ug(?:\s*\(haftungsbeschränkt\))?|e\.\s?k\.?|kg|ohg|gbr|ltd\.?|limited|inc\.?|llc|s\.?l\.?|b\.?v\.?|se|s\.?a\.?r\.?l\.?|co\.?,?\s*ltd\.?|corp\.?)(?![a-zäöü])/i;
  const ocrNorm = s => String(s||"").toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]/g,"");
  function ocrHasName(line, name){
    const n=ocrNorm(name); if(!n) return false;
    if(n.length<=4) return new RegExp(`(^|[^a-z0-9äöü])${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^a-z0-9äöü]|$)`,"i").test(line);
    return ocrNorm(line).includes(n);
  }
  function ocrCleanName(s){
    s=String(s||"").replace(/^[\s:–\-•|*#]+/,"").split(/\s[|•·]\s|,\s(?!(?:ltd|inc|llc|kg|co)\b)|\s{2,}|\s[-–]\s(?=\D)|\(|\b(str\.|straße|strasse|weg|platz|allee)\b|\b\d{5}\b|tel\b|www\.|@/i)[0];
    return s.replace(/[\s.:;,–\-]+$/,"").trim().slice(0,48);
  }
  // Zeilen, die nie ein Händlername sind: Steuer-, Bank-, Register- und Kontaktangaben
  const OCR_META = /(ust\.?\s*[-‐]?\s*id|\bu?st\.?\s*[-‐]?\s*id\b|ust[-‐]?idnr|umsatzsteuer[-‐\s]*id|ust\.?\s*nr|steuer\s*[-‐]?\s*(nr|nummer|id)|steuernummer|vat\b|tax\s*id|iban|\bbic\b|swift|bankverbindung|\bbank\b|sparkasse|volksbank|handelsregister|\bhrb?\b|amtsgericht|registergericht|geschäftsführ|inhaber|tel\.?\b|telefon|fax|e-?mail|www\.|https?:|@|\bde\s?\d{9}\b|steuer|mwst|\bvat\b|privatverkauf|ohne\s+umsatz)/i;
  const OCR_DOCWORD = /(rechnung|invoice|quittung|kassenbon|beleg|lieferschein|gutschrift|angebot|bestell|auftrag|kunde|datum|date|seite|page|artikel|menge|summe|betrag|zahlart|zahlung|versand|liefer|anschrift|adresse|empfänger|absender|bon\b|kasse|filiale)/i;
  const OCR_ADDR = /(\b\d{5}\b|str\.|straße|strasse|(weg|platz|allee|gasse|ring|damm|ufer|markt|chaussee|steig|pfad)\s*\d|postfach|\bpostbox\b)/i;
  function ocrShop(text, known=[], own=[]){
    const L=ocrClean(text).split("\n").map(x=>x.trim()).filter(Boolean);
    const isOwn = line => own.some(o=>o && ocrNorm(o).length>2 && ocrNorm(line).includes(ocrNorm(o)));
    const isPlat = line => OCR_PLATFORMS.some(pl=>ocrHasName(line,pl));
    const isMeta = line => OCR_META.test(line);
    const letters = s => (String(s).match(/[a-zäöüß]/gi)||[]).length;
    const plausible = v => v && v.length>=3 && letters(v)>=3 && letters(v) >= String(v).replace(/\s/g,"").length*0.5 && !isMeta(v) && !isOwn(v);
    const known2=[...known.filter(Boolean), ...OCR_KNOWN];
    const knownIn = line => known2.filter(k=>ocrHasName(line,k)).sort((a,b)=>b.length-a.length)[0];
    // 1. „Verkauft von …“ / „Verkäufer: …“ / „Sold by …“ / „Store: …“ – nur echte Namen, nie Steuer-/Bankzeilen
    for(let i=0;i<L.length;i++){
      if(isMeta(L[i])) continue;
      const m=L[i].match(/(?:verkauft\s+(?:und\s+versandt\s+)?von|verk[äa]ufer(?:in)?\s*:|sold\s+by|seller\s*:|vendor\s*:|store\s*:|shop\s*:|h[äa]ndler\s*:)\s*(.*)$/i);
      if(!m) continue;
      let v=ocrCleanName(m[1]); if(!plausible(v) && L[i+1] && !isMeta(L[i+1])) v=ocrCleanName(L[i+1]);
      if(plausible(v) && !OCR_PLATFORMS.some(pl=>ocrNorm(pl)===ocrNorm(v))) return {name:knownIn(v)||v, quelle:"verkaeufer", sicher:true};
    }
    // 2. Briefkopf (oberste Zeilen, ohne eigene Adresse und Meta-Zeilen)
    const head=L.slice(0,6).filter(l=>!isOwn(l) && !isMeta(l)), top=L.slice(0,5).filter(l=>!isOwn(l) && !isMeta(l));
    for(const l of head){ const k=knownIn(l); if(k && !isPlat(k)) return {name:k, quelle:"kopf", sicher:true}; }
    // 2b. die erste markante Textzeile ganz oben = Firmenname
    for(const [idx,l] of top.entries()){
      if(isPlat(l) || OCR_DOCWORD.test(l) || OCR_ADDR.test(l) || l.includes(":")) continue;
      const v=ocrCleanName(l);
      if(!plausible(v) || v.length>42 || /^\W*$/.test(v)) continue;
      if(/^[A-ZÄÖÜ\s&.\-]+$/.test(v) && idx>0 && !OCR_LEGAL.test(v)) continue; // Slogan in Großbuchstaben unter dem Namen
      return {name:v, quelle:"kopf", sicher: idx===0 || OCR_LEGAL.test(v)};
    }
    // 3. bekannter Shop irgendwo (z. B. im Fuß oder als Web-Adresse)
    for(const l of L){ if(isOwn(l)) continue; const k=knownIn(l); if(k && !isPlat(k)) return {name:k, quelle:"bekannt", sicher:true}; }
    // 3b. Rechtsform-Zeile weiter unten (Fußzeile mit Firmenangaben)
    for(const l of L.slice(6)){ if(!isOwn(l) && !isMeta(l) && OCR_LEGAL.test(l) && !isPlat(l) && !/rechnung|invoice|kunde|sitz|registergericht/i.test(l)){ const v=ocrCleanName(l.replace(/^(firmensitz|firma|sitz)\s*:?\s*/i,"")); if(plausible(v)) return {name:v, quelle:"fuss", sicher:false}; } }
    // 4. nur die Plattform
    for(const l of L){ const pl=OCR_PLATFORMS.find(x=>ocrHasName(l,x)); if(pl) return {name:pl, quelle:"plattform", sicher:false}; }
    return null;
  }
  /* Rechnungsnummer */
  const OCR_NR_KW = [
    [/(?:rechnungs?|rg\.?)\s*[-‐]?\s*(?:nr|nummer|no|nº|n°)\b\.?/i, 10],
    [/rechnung\s*(?:nr|nummer|no|n°)?\.?\s*[:#]/i, 9],
    [/^\s*rechnung\s+(?=[A-Za-z]{0,4}[-‐]?\d)/i, 9],
    [/\binvoice\s*(?:no|nr|number|num|#|id)\b\.?|\binvoice\s*#/i, 10],
    [/\binv\.?\s*(?:no|nr|#)|\binv\s*#/i, 9],
    [/\bre\.?\s*[-‐]?\s*nr\b\.?/i, 9],
    [/\b(?:beleg|bon|quittungs?|kassenbon|transaktions)\s*[-‐]?\s*(?:nr|nummer|no)\b\.?/i, 5],
  ];
  const OCR_NR_BAD = /(bestell|auftrags|kunden|steuer|ust|artikel|liefer(?:schein)?|sendungs|tracking|telefon|tel\b|konto|referenz|vertrags|mandats|order)/i;
  function ocrNrToken(rest){
    const t=String(rest||"").replace(/^[\s:#.\-–=]+/,"").match(/^([A-Za-z0-9][A-Za-z0-9\-\/._]{2,30})/);
    if(!t) return null; let v=t[1].replace(/[._\-\/]+$/,"");
    if(!/\d/.test(v) || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(v) || v.length<3) return null;
    v=v.replace(/(?<=\d)[oO](?=\d)/g,"0").replace(/(?<=\d)[lI|](?=\d)/g,"1").replace(/(?<=\d)S(?=\d)/g,"5")
       .replace(/^(RE|RG|INV|AR|R)([SOIlB])(?=\d)/,(m,p,c)=>p+({S:"5",O:"0",I:"1",l:"1",B:"8"})[c]);
    return v;
  }
  function ocrInvoiceNr(text){
    const L=ocrClean(text).split("\n").map(x=>x.trim()).filter(Boolean); const cand=[];
    L.forEach((line,i)=>{
      for(const [rx,score] of OCR_NR_KW){
        const m=rx.exec(line); if(!m) continue;
        const before=line.slice(Math.max(0,m.index-14), m.index);
        if(OCR_NR_BAD.test(before+" "+m[0].replace(/rechnung|invoice/ig,""))) continue;
        let v=ocrNrToken(line.slice(m.index+m[0].length));
        if(!v && L[i+1]) v=ocrNrToken(L[i+1]);
        if(v){ cand.push({v, s:score, i}); break; }
      }
      // Muster ohne Schlüsselwort: RE-2026-0042, RE2026123, INV-12345
      const m2=line.match(/(?<![A-Za-z0-9])((?:RE|RG|INV|IN|R)[-‐ ]?\d{2,}(?:[-\/]\d+)*)(?![A-Za-z0-9])/);
      if(m2 && !OCR_NR_BAD.test(line)) cand.push({v:m2[1].replace(/\s/g,"-").replace("‐","-"), s:6, i});
    });
    if(!cand.length) return null;
    const best=cand.reduce((a,b)=>b.s>a.s||(b.s===a.s&&b.i<a.i)?b:a);
    return {nr:best.v, sicher:best.s>=9};
  }
  function ocrExtract(text, known=[], own=[]){ return { betrag:ocrAmount(text), datum:ocrDate(text), satz:ocrSatz(text), lieferant:ocrShop(text, known, own), nr:ocrInvoiceNr(text) }; }

  /* ---------- KI-Belegerkennung: Google Gemini (Vision) ---------- */
  // gemini-1.5-flash (abgeschaltet 29.09.2025) und gemini-2.0-flash (abgeschaltet 01.06.2026) gibt es nicht mehr.
  // Die App fragt Google, welche Modelle der Key nutzen darf, und probiert sie der Reihe nach (siehe geminiOrder).
  const geminiKey = () => String(S.firma.geminiApiKey||"").trim();
  // System-Prompt für die Belegerkennung (Regeln). Das Ausgabeformat (JSON) bleibt unverändert.
  function geminiSystem(){
    const own=[S.firma.name, S.firma.ansprechpartner, S.firma.strasse && `${S.firma.strasse}, ${[S.firma.plz,S.firma.ort].filter(Boolean).join(" ")}`].filter(Boolean).join(" · ");
    const known=[...new Set(S.ausgaben.map(a=>a.lieferant).filter(Boolean))].slice(0,40);
    const heute=deDate(today());
    return `Du bist ein präziser Buchhaltungs-Assistent für eine Handy-Reparaturwerkstatt in Deutschland. Du liest Eingangsrechnungen, Kassenbons und Quittungen aus – auch verknitterte, schief fotografierte oder schlecht belichtete.

  AUSGABE (STRIKT)
  - Antworte AUSSCHLIESSLICH mit dem puren JSON-Objekt – kein Markdown, keine Codeblöcke, kein Text davor oder danach.
  - Format: {"haendler": "…", "datum": "DD.MM.YYYY", "rechnungsnr": "…", "brutto": 0.00, "mwst_prozent": 19, "notiz": "…", "kategorie": "…"}
  - Grundsatz: Lieber leer als geraten. Ist ein Textfeld nicht sicher erkennbar, gib "" zurück. Ist "brutto" nicht sicher bestimmbar, gib null zurück.

  1. BRUTTO = TATSÄCHLICH GEZAHLTER ENDBETRAG
  - Suche gezielt nach: "Gesamtbetrag", "Gesamtsumme", "Endsumme", "Endbetrag", "Rechnungsbetrag", "Zu zahlen", "Zahlbetrag", "Summe EUR", "Total", "Paid", "Bar", "EC/Girocard/Kartenzahlung".
  - Ignoriere: Zwischensummen, Netto-Beträge, MwSt.-Beträge, Einzelpreise, Rabattzeilen, Pfand, "Gegeben", "Rückgeld", "Wechselgeld", Trinkgeld-Vorschläge.
  - Versandkosten, Rabatte und Skonti sind im Endbetrag bereits verrechnet – nichts doppelt abziehen oder addieren. Nimm stets die unterste, finale Endsumme.
  - Bei Barzahlung ist "Bar 50,00 / Rückgeld 7,10" NICHT der Betrag – der Betrag ist die Summe davor.

  2. ZAHLENFORMAT & OCR-FEHLER
  - Deutsche Schreibweise beachten: "1.234,56" → 1234.56 ; "12,90" → 12.90. Im JSON immer Punkt als Dezimaltrenner, ohne Währungszeichen und ohne Tausenderpunkt.
  - Buchstaben in Beträgen sind Lesefehler: O/o → 0, l/I/| → 1, S → 5, B → 8, Z → 2. Ein Betrag besteht nur aus Ziffern.

  3. MATHEMATISCHE PLAUSIBILITÄT
  - Prüfe immer: Brutto = Netto + MwSt.-Betrag (Rundung ±0,02 €) und MwSt.-Betrag ≈ Netto × Satz (19 % oder 7 %).
  - Bei mehreren Steuersätzen: Brutto = Summe aller Netto-Beträge + Summe aller MwSt.-Beträge.
  - Wenn die Positionen addiert werden können, müssen sie (inkl. Versand, abzgl. Rabatt) den Endbetrag ergeben.
  - Ist eine Ziffer durch Knick, Schatten oder Unschärfe unleserlich, rekonstruiere sie mit diesen Formeln – aber NUR, wenn das Ergebnis eindeutig aufgeht. Geht die Rechnung nicht eindeutig auf, gib "brutto": null zurück.
  - Widersprechen sich Endbetrag und Netto+MwSt., vertraue der Rechnung, die mit den meisten Beträgen auf dem Beleg übereinstimmt.

  4. HÄNDLER = AUSSTELLER (NIE DER EMPFÄNGER)
  - Der Händler ist IMMER das ausstellende Unternehmen bzw. der Shop – meist groß im Kopf/Logo ganz oben, oft wiederholt in der Fußzeile oder Absenderzeile über der Anschrift.
  - Der Käufer/Empfänger ist NIEMALS der Händler. Der Empfänger ist diese Werkstatt bzw. ihr Inhaber: ${own||"(Firmendaten nicht hinterlegt)"}. Diese Namen und Adressen nie als Händler verwenden.
  - Niemals als Händler: Zeilen mit USt-IdNr., Steuernummer, IBAN, BIC, Bank, Handelsregister, Geschäftsführer, Telefon, E-Mail, Web-Adresse, Straße/PLZ, oder Slogans.
  - Bekannte Händler (MobileSentrix, Reichelt, Conrad, Mouser, DigiKey, Hornbach, Bauhaus, OBI, DHL, Deutsche Post, Hermes, DPD …): exakten Markennamen verwenden, ohne Rechtsform-Zusatz wenn der Markenname eindeutig ist.
  - Marktplätze (eBay, Amazon, AliExpress, Kaufland, Otto, Etsy): Ist ein konkreter Verkäufer genannt ("Verkauft von", "Verkäufer", "Sold by", "Store", eigener Briefkopf des Händlers), nimm DIESEN Verkäufer. Nur wenn keiner genannt ist, den Plattformnamen (z. B. "Amazon").${known.length?`
  - Bereits verwendete Händlernamen dieser Werkstatt (bei Übereinstimmung exakt diese Schreibweise nutzen): ${known.join(", ")}.`:""}

  5. RECHNUNGSNUMMER
  - Suche gezielt nach: "Rechnungsnummer", "Rechnungs-Nr.", "Rechnung Nr.", "RE-Nr.", "RE-…", "RG-…", "Beleg-Nr.", "Bon-Nr.", "Invoice No.", "Invoice #", "Inv #", "Receipt #".
  - NICHT verwenden: Kunden-, Bestell-, Auftrags-, Artikel-, Liefer-, Sendungs-, Transaktions- oder Steuernummern.
  - Gibt es keine Rechnungs- oder Belegnummer (z. B. einfacher Supermarkt- oder Tankbon ohne Nummer), gib "" zurück. Erfinde NIEMALS eine Nummer.

  6. DATUM
  - Wähle STRIKT das Rechnungs- bzw. Belegdatum ("Rechnungsdatum", "Belegdatum", "Datum" im Rechnungskopf, Datum auf dem Kassenbon).
  - Nicht verwenden: Bestelldatum, Liefer-/Versanddatum, voraussichtliches Lieferdatum, Fälligkeits-/Zahlungsziel, Leistungszeitraum-Ende, Geburtsdatum, Ablauf-/MHD-Datum, Ausstellungsdatum von Zertifikaten.
  - Gibt es nur ein Erstellungs- oder Druckdatum, nimm dieses.
  - Heute ist der ${heute}. Das Datum darf NIE in der Zukunft liegen. Zweistellige Jahre (z. B. 26) bedeuten 20xx.
  - Format DD.MM.YYYY. Unsicher → "".

  7. MWST, NOTIZ, KATEGORIE
  - mwst_prozent: 19, 7 oder 0 (0 bei Kleinunternehmer-Hinweis § 19 UStG, Privatverkauf, Porto/Briefmarken ohne MwSt.). Bei gemischten Sätzen den Satz mit dem größeren Anteil.
  - notiz: sehr kurze Zusammenfassung auf Deutsch, was gekauft wurde (max. 80 Zeichen, Stichworte mit Komma, Gerätemodelle kurz), z. B. "Display für S22, Lötflussmittel". Keine Preise. Unklar → "".
  - kategorie: genau einer dieser Werte: ${AKAT.map(k=>`"${k}"`).join(", ")}. Handy-/Tablet-Ersatzteile, Akkus, Displays, Gehäuse = "Ersatzteile"; Schraubendreher, Lötstation, Messgeräte = "Werkzeug"; Versand, Porto, Paket = "Porto/Versand"; Lötzinn, Flussmittel, Kleber, Reinigung, Schutzfolien = "Verbrauchsmaterial"; Papier, Drucker, Software, Abos = "Büro & Software".

  Prüfe vor der Antwort still: Ist "brutto" wirklich der Endbetrag und mathematisch plausibel? Ist "haendler" der Aussteller und nicht der Empfänger? Ist "rechnungsnr" wirklich eine Rechnungs-/Belegnummer? Liegt "datum" nicht in der Zukunft?`;
  }
  function geminiPrompt(){
    return `Analysiere diesen Beleg/diese Rechnung nach den Regeln und antworte AUSSCHLIESSLICH mit dem gültigen JSON-Objekt ohne Markdown-Codeblocks: {"haendler": "Name des Verkäufers/Shops", "datum": "DD.MM.YYYY", "rechnungsnr": "Rechnungsnummer", "brutto": 0.00, "mwst_prozent": 19, "notiz": "Kurzbeschreibung der gekauften Artikel", "kategorie": "Ersatzteile"}`;
  }

  async function geminiImageData(beleg){
    if(beleg.typ==="application/pdf") return { mime_type:"application/pdf", data:beleg.data.split(",")[1] };
    const src=OCR_SRC.get(beleg);
    if(src){ try{ const url=URL.createObjectURL(src); try{
        const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
        const sc=Math.min(1, 2048/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement("canvas");
        c.width=Math.round(img.naturalWidth*sc); c.height=Math.round(img.naturalHeight*sc);
        const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
        return { mime_type:"image/jpeg", data:c.toDataURL("image/jpeg",.85).split(",")[1] };
      } finally { URL.revokeObjectURL(url); } }catch(e){} }
    return { mime_type:"image/jpeg", data:beleg.data.split(",")[1] };
  }
  class GeminiError extends Error{ constructor(code, msg){ super(msg); this.code=code; } }
  const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
  const GEMINI_MSG = {
    offline:"Keine Internetverbindung – das Gerät ist offline",
    net:"Netzwerkfehler – Google ist nicht erreichbar (Verbindung, VPN, Werbeblocker oder iCloud Privat-Relay prüfen)",
    key:"Ungültiger API-Key – bitte in Google AI Studio prüfen und neu einfügen",
    disabled:"Die Gemini API ist für dieses Google-Projekt nicht aktiviert",
    region:"Gemini ist für dieses Konto bzw. diese Region nicht freigeschaltet",
    quota:"Kontingent erschöpft (kostenloses Limit pro Minute/Tag) – später nochmal versuchen",
    busy:"Google-Server gerade überlastet – bitte gleich nochmal versuchen",
    timeout:"Zeitüberschreitung – Google hat nicht rechtzeitig geantwortet",
    model:"Modell nicht verfügbar",
    big:"Datei zu groß für die KI",
    parse:"Antwort der KI nicht lesbar",
    nokey:"Kein API-Key hinterlegt",
    fail:"Unbekannter Fehler"
  };
  const gemMsg = e => GEMINI_MSG[e?.code] || e?.message || GEMINI_MSG.fail;
  const GEM_GLOBAL = ["key","disabled","region","offline","big","nokey"];   // betrifft alle Modelle → nicht weiter probieren
  function gemErr(status, err){
    const msg=err?.error?.message||"", st=err?.error?.status||"", reason=JSON.stringify(err?.error?.details||"");
    const all=msg+" "+st+" "+reason;
    if(/API_KEY_INVALID|API key not valid|API key expired|API_KEY_/i.test(all)) return new GeminiError("key", msg);
    if(/SERVICE_DISABLED|has not been used in project|is disabled/i.test(all)) return new GeminiError("disabled", msg);
    if(/location is not supported|not available in your country|FAILED_PRECONDITION/i.test(all)) return new GeminiError("region", msg);
    if(status===401 || status===403 || st==="PERMISSION_DENIED" || st==="UNAUTHENTICATED") return new GeminiError("key", msg);
    if(status===429 || st==="RESOURCE_EXHAUSTED") return new GeminiError("quota", msg);
    if(status===404 || st==="NOT_FOUND" || /is not found|not supported for generateContent/i.test(msg)) return new GeminiError("model", msg);
    if(status===400 && /thinking/i.test(msg)) return new GeminiError("thinking", msg);
    if(status===413 || /too large|exceeds the maximum|payload size/i.test(msg)) return new GeminiError("big", msg);
    if(status>=500 || st==="UNAVAILABLE" || st==="INTERNAL" || st==="DEADLINE_EXCEEDED") return new GeminiError("busy", `HTTP ${status} ${msg}`.trim());
    return new GeminiError("fail", `HTTP ${status}${msg?": "+msg:""}`);
  }
  async function gemFetch(url, opts, ms){
    if(navigator.onLine===false) throw new GeminiError("offline","offline");
    const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(), ms);
    try{ return await fetch(url, {...opts, signal:ctl.signal, cache:"no-store"}); }
    catch(e){ if(e.name==="AbortError") throw new GeminiError("timeout", `keine Antwort nach ${Math.round(ms/1000)} s`);
      throw new GeminiError(navigator.onLine===false?"offline":"net", e.message||"Load failed"); }
    finally{ clearTimeout(t); }
  }
  // Welche Modelle darf dieser Key nutzen? (einmal pro halbe Stunde abfragen)
  let GEM_LIST=null;
  async function geminiListModels(key, ms=12000){
    if(GEM_LIST && GEM_LIST.key===key && Date.now()-GEM_LIST.at<30*60e3) return GEM_LIST.models;
    const res=await gemFetch(`${GEMINI_BASE}/models?pageSize=1000&key=${encodeURIComponent(key)}`, {}, ms);
    if(!res.ok) throw gemErr(res.status, await res.json().catch(()=>({})));
    const data=await res.json().catch(()=>({}));
    const models=(data.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent")).map(m=>String(m.name).replace(/^models\//,""));
    GEM_LIST={key, at:Date.now(), models}; return models;
  }
  const gemVer = n => { const m=String(n).match(/gemini-(\d+(?:\.\d+)?)/); return m?+m[1]:0; };
  const gemUsable = n => /flash/i.test(n) && !/(image|tts|audio|live|embedding|exp|thinking|computer|robotics|native|learnlm)/i.test(n);
  function gemGood(){ try{ return localStorage.getItem("rm-gem-good")||""; }catch(e){ return ""; } }
  function setGemGood(m){ try{ localStorage.setItem("rm-gem-good", m); }catch(e){} }
  // Reihenfolge: eigenes Modell → zuletzt erfolgreiches → „latest“-Alias → neueste stabile Flash-Modelle → Flash-Lite
  function geminiOrder(avail, wanted=String(S.firma.geminiModel||"").trim()){
    const has = n => !avail.length || avail.includes(n);
    const stable=avail.filter(n=>gemUsable(n) && !/preview|lite|-\d{3}$/i.test(n) && !/latest/.test(n)).sort((a,b)=>gemVer(b)-gemVer(a));
    const lite=avail.filter(n=>gemUsable(n) && /lite/i.test(n) && !/preview|-\d{3}$/i.test(n) && !/latest/.test(n)).sort((a,b)=>gemVer(b)-gemVer(a));
    const order=[wanted, gemGood(), "gemini-flash-latest", ...stable.slice(0,2), "gemini-2.5-flash", "gemini-flash-lite-latest", ...lite.slice(0,1)];
    const out=[]; for(const m of order) if(m && !out.includes(m) && (m===wanted || has(m))) out.push(m);
    return out.slice(0,5);
  }
  function gemBody(parts, json, model, thinking, system, sysField){
    const body={ contents:[{role:"user", parts: system && !sysField ? [{text:system}, ...parts] : parts}], generationConfig:{ temperature:0 } };
    if(system && sysField) body.systemInstruction={ parts:[{text:system}] };
    if(json) Object.assign(body.generationConfig, { responseMimeType:"application/json", responseSchema:{ type:"OBJECT", properties:{
      haendler:{type:"STRING", nullable:true}, datum:{type:"STRING", nullable:true}, rechnungsnr:{type:"STRING", nullable:true},
      brutto:{type:"NUMBER", nullable:true}, mwst_prozent:{type:"NUMBER", nullable:true},
      notiz:{type:"STRING", nullable:true}, kategorie:{type:"STRING", nullable:true, enum:AKAT} } } });
    // Schneller antworten: Denkphase klein halten (wird bei Ablehnung automatisch weggelassen)
    // Belege: etwas Denkzeit für die Plausibilitäts-Rechnung; Verbindungstest: so schnell wie möglich
    if(thinking){ if(/2\.5-flash/.test(model)) body.generationConfig.thinkingConfig={thinkingBudget: system ? 1024 : 0};
      else if(/latest|gemini-[3-9]/.test(model)) body.generationConfig.thinkingConfig={thinkingLevel:"low"}; }
    return body;
  }
  async function geminiCall(parts, {json=true, timeout=45000, key=geminiKey(), models=null, total=100000, onModel=null, system=""}={}){
    if(!key) throw new GeminiError("nokey","Kein API-Key");
    if(!models){
      let avail=[];
      try{ avail=await geminiListModels(key); }
      catch(e){ if(GEM_GLOBAL.includes(e.code)) throw e; }   // Liste nicht abrufbar (z. B. kurz Netz weg) → mit Standardliste weiter
      models=geminiOrder(avail);
    }
    const tried=[], start=Date.now();
    for(const [n, model] of models.entries()){
      const left=total-(Date.now()-start); if(left<5000) break;
      const ms=Math.min(n===0?timeout:Math.min(timeout,30000), left);
      onModel?.(model, n);
      const t0=Date.now(), url=`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      try{
        let thinking=true, sysField=true, res;
        for(;;){
          res=await gemFetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(gemBody(parts, json, model, thinking, system, sysField)) }, ms);
          if(res.ok) break;
          const e=gemErr(res.status, await res.json().catch(()=>({})));
          if(system && sysField && res.status===400 && /system_?instruction|systemInstruction|developer instruction/i.test(e.message)){ sysField=false; continue; }
          if(e.code==="thinking" && thinking){ thinking=false; continue; }
          if(res.status===400 && thinking && /thinking|Unknown name|Invalid JSON payload/i.test(e.message)){ thinking=false; continue; }
          throw e;
        }
        const data=await res.json().catch(()=>null);
        const text=(data?.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||"").join("").trim();
        if(!text) throw new GeminiError("parse", data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || "leere Antwort");
        setGemGood(model);
        return {text, model, ms:Date.now()-t0, tried};
      }catch(e){
        if(!(e instanceof GeminiError)) e=new GeminiError("fail", e.message);
        tried.push({model, code:e.code, msg:e.message, ms:Date.now()-t0});
        if(GEM_GLOBAL.includes(e.code)) { e.tried=tried; throw e; }
        if(gemGood()===model) setGemGood("");
      }
    }
    const last=tried[tried.length-1]||{code:"model", msg:"Kein Modell erreichbar"};
    // Wenn alle Modelle am selben Problem scheitern, genau das melden
    const codes=[...new Set(tried.map(t=>t.code))];
    const e=new GeminiError(codes.length===1?codes[0]:last.code, last.msg); e.tried=tried; throw e;
  }
  function geminiParse(text){
    let t=String(text||"").replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"").trim();
    const a=t.indexOf("{"), b=t.lastIndexOf("}"); if(a<0||b<a) throw new GeminiError("parse","kein JSON");
    let o; try{ o=JSON.parse(t.slice(a,b+1)); }catch(e){ throw new GeminiError("parse", e.message); }
    const str=v=> (v==null || /^(null|unbekannt|unknown|keine?|none|n\/?a|n\.a\.|-+|–|\?+)$/i.test(String(v).trim())) ? "" : String(v).trim();
    // Datum: DD.MM.YYYY, D.M.YY oder YYYY-MM-DD
    let iso=null; const ds=str(o.datum); let m;
    if((m=ds.match(/^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2,4})$/))){ let y=+m[3]; if(y<100) y+=2000; iso=`${y}-${pad(+m[2])}-${pad(+m[1])}`; }
    else if((m=ds.match(/^(\d{4})-(\d{2})-(\d{2})/))) iso=`${m[1]}-${m[2]}-${m[3]}`;
    if(iso){ const d=new Date(iso+"T12:00"); if(isNaN(d) || isoDay(d)!==iso || d>new Date(Date.now()+2*864e5)) iso=null; }
    let br = typeof o.brutto==="number" ? o.brutto : (str(o.brutto) ? parseNum(str(o.brutto).replace(/[^\d,.\-]/g,"")) : NaN);
    br = isFinite(br) && br>0 ? r2(br) : null;
    let p = o.mwst_prozent==null || o.mwst_prozent==="" ? null : parseFloat(String(o.mwst_prozent).replace(",","."));
    if(p!=null && isFinite(p)) p=[19,7,0].reduce((a,b)=>Math.abs(b-p)<Math.abs(a-p)?b:a); else p=null;
    let h=str(o.haendler); if(h && OCR_META.test(h)) h="";
    const nr=str(o.rechnungsnr).replace(/^(nr\.?|no\.?|#)\s*/i,"");
    let notiz=str(o.notiz).replace(/\s+/g," "); if(notiz.length>120) notiz=notiz.slice(0,117).replace(/[,\s]+\S*$/,"")+" …";
    const kat=geminiKat(str(o.kategorie));
    return { betrag: br!=null?{v:br, sicher:true}:null, datum: iso?{iso, sicher:true}:null, lieferant: h?{name:h.slice(0,60), sicher:true, quelle:"ki"}:null,
             nr: nr?{nr:nr.slice(0,40), sicher:true}:null, satz:p, notiz: notiz||null, kategorie: kat };
  }
  const KAT_SYN = {"versand":"Porto/Versand","versandkosten":"Porto/Versand","porto":"Porto/Versand","paket":"Porto/Versand","büromaterial":"Büro & Software","buero":"Büro & Software","büro":"Büro & Software","software":"Büro & Software","material":"Verbrauchsmaterial","verbrauch":"Verbrauchsmaterial","teile":"Ersatzteile","ersatzteil":"Ersatzteile","werkzeuge":"Werkzeug","miete":"Miete & Nebenkosten","auto":"Fahrzeug","kfz":"Fahrzeug","tanken":"Fahrzeug","marketing":"Werbung","werbung":"Werbung"};
  function geminiKat(v){ if(!v) return null; const l=v.toLowerCase().trim();
    const exact=AKAT.find(k=>k.toLowerCase()===l); if(exact) return exact;
    for(const [w,k] of Object.entries(KAT_SYN)) if(l.includes(w)) return k;
    return AKAT.find(k=>l.includes(k.toLowerCase().split(/[ /&]/)[0])) || null; }
  async function geminiBeleg(beleg, onModel){
    if(beleg.typ==="application/pdf" && beleg.data.length > 19*1024*1024) throw new GeminiError("big","PDF zu groß");
    const r=await geminiCall([{text:geminiPrompt()}, {inline_data:await geminiImageData(beleg)}], {onModel, system:geminiSystem()});
    return { ...geminiParse(r.text), model:r.model, ms:r.ms, tried:r.tried, raw:r.text };
  }
  // Verbindungstest Schritt für Schritt: Internet → Key & Modellliste → Antwort eines Modells
  async function geminiDiagnose(key, model, step){
    key=String(key||"").trim(); model=String(model||"").trim();
    const out={ok:false, steps:[]}; const add=(ok,t,d="")=>{ out.steps.push({ok,t,d}); step?.(out.steps); };
    if(!key){ add(false,"API-Key", GEMINI_MSG.nokey); return out; }
    if(navigator.onLine===false){ add(false,"Internet", GEMINI_MSG.offline); return out; }
    add(true,"Internet","verbunden");
    let avail=[]; const t0=Date.now();
    try{ GEM_LIST=null; avail=await geminiListModels(key, 15000); add(true,"Google & API-Key", `gültig · ${avail.filter(gemUsable).length} Flash-Modelle · ${((Date.now()-t0)/1000).toFixed(1).replace(".",",")} s`); }
    catch(e){ add(false,"Google & API-Key", gemMsg(e)+(e.message&&!GEMINI_MSG[e.message]?` (${e.message.slice(0,90)})`:"")); return out; }
    out.models=avail.filter(gemUsable);
    if(model && !avail.includes(model)) add(false,"Eingetragenes Modell", `„${model}“ gibt es für diesen Key nicht – wird übersprungen`);
    const order=geminiOrder(avail, model && avail.includes(model) ? model : "");
    try{ const r=await geminiCall([{text:"Antworte nur mit dem Wort OK."}], {json:false, timeout:25000, total:60000, key, models:order});
      for(const t of r.tried) add(false, t.model, gemMsg(t));
      add(true, r.model, `antwortet · ${(r.ms/1000).toFixed(1).replace(".",",")} s`); out.ok=true; out.model=r.model; }
    catch(e){ for(const t of (e.tried||[])) add(false, t.model, gemMsg(t)); if(!(e.tried||[]).length) add(false,"Modell", gemMsg(e)); }
    return out;
  }

  /* ---------- Ausgaben & Beleg-Scan (Eingangsrechnungen) ---------- */
  const AKAT = ["Ersatzteile","Werkzeug","Porto/Versand","Verbrauchsmaterial","Büro & Software","Miete & Nebenkosten","Fahrzeug","Werbung","Sonstiges"];
  const AKAT_C = {"Ersatzteile":"#29aae1","Werkzeug":"#e8912d","Porto/Versand":"#8b6fd6","Verbrauchsmaterial":"#2fa36b","Büro & Software":"#4a6fa5","Miete & Nebenkosten":"#c4507a","Fahrzeug":"#7a8a99","Werbung":"#d6b12f","Sonstiges":"#98a2ad"};
  const SAETZE = [19,7,0];
  const DB_IMG_MAX = 240000;   // Zeichen – passt sicher in ein Datenbank-Dokument
  const aCalc = x => { const b=r2(+x.brutto||0), p=+x.satz||0; const n=p?r2(b/(1+p/100)):b; return {brutto:b, netto:n, vst:r2(b-n), p}; };
  const ausIn = pre => S.ausgaben.filter(x=>(x.datum||"").startsWith(pre)).sort((a,b)=>(b.datum||"").localeCompare(a.datum||"") || (b.created||"").localeCompare(a.created||""));
  const monthLabel = ym => MONTHS[+ym.slice(5,7)-1]+" "+ym.slice(0,4);
  const kbTxt = n => n>1048576 ? (n/1048576).toFixed(1).replace(".",",")+" MB" : Math.max(1,Math.round(n/1024))+" KB";

  /* Bildspeicher: IndexedDB auf dem Gerät + (wenn angemeldet) Kopie im Konto */
  const BILD = {
    _p:null,
    open(){ if(this._p) return this._p; this._p=new Promise(res=>{ try{ const r=indexedDB.open("rm-belege",1); r.onupgradeneeded=()=>r.result.createObjectStore("b"); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); }catch(e){ res(null); } }); return this._p; },
    async tx(mode, fn){ const db=await this.open(); if(!db) return null; return new Promise(res=>{ try{ const t=db.transaction("b",mode); const rq=fn(t.objectStore("b")); t.oncomplete=()=>res(rq?.result ?? null); t.onerror=t.onabort=()=>res(null); }catch(e){ res(null); } }); },
    cache:new Map(),
    async put(id, rec){ this.cache.set(id,rec); await this.tx("readwrite", s=>s.put(rec,id)); cloudQueue("beleg", id, {typ:rec.typ, data:rec.data, name:rec.name, size:rec.size});
      if(mode==="db" && dbRefs?.bilder && rec.data.length<=DB_IMG_MAX){ try{ await dbRefs.bilder.doc(id).set(rec); return true; }catch(e){ return false; } } return mode!=="db"; },
    async get(id){ if(this.cache.has(id)) return this.cache.get(id);
      let rec=await this.tx("readonly", s=>s.get(id));
      if(!rec && mode==="db" && dbRefs?.bilder){ try{ const s=await dbRefs.bilder.doc(id).get(); if(s.exists){ rec=s.data(); this.tx("readwrite", st=>st.put(rec,id)); } }catch(e){} }
      if(!rec && cloudOn()){ rec=await cloudBeleg(id); if(rec) this.tx("readwrite", st=>st.put(rec,id)); }
      if(rec) this.cache.set(id,rec); return rec||null; },
    async del(id){ this.cache.delete(id); await this.tx("readwrite", s=>s.delete(id)); cloudQueue("beleg", id, null, true); if(mode==="db" && dbRefs?.bilder){ try{ await dbRefs.bilder.doc(id).delete(); }catch(e){} } }
  };

  async function compressImage(file){
    const url=URL.createObjectURL(file);
    try{
      const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
      const c=document.createElement("canvas"), g=c.getContext("2d"); let max=1600, q=.82, out="";
      for(let k=0;k<8;k++){
        const sc=Math.min(1, max/Math.max(img.naturalWidth,img.naturalHeight));
        c.width=Math.round(img.naturalWidth*sc); c.height=Math.round(img.naturalHeight*sc);
        g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
        out=c.toDataURL("image/jpeg",q); if(out.length<=DB_IMG_MAX-2000) break;
        if(q>.56) q-=.1; else max=Math.round(max*.8);
      }
      return out;
    } finally { URL.revokeObjectURL(url); }
  }
  const readDataUrl = file => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
  async function fileToBeleg(file){
    if(!file) return null;
    const isPdf = file.type==="application/pdf" || /\.pdf$/i.test(file.name||"");
    if(isPdf){ if(file.size>15*1048576){ toast("PDF ist zu groß (max. 15 MB)"); return null; } return { typ:"application/pdf", data:await readDataUrl(file), name:file.name||"Beleg.pdf", size:file.size }; }
    if(!/^image\//.test(file.type||"") && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name||"")){ toast("Bitte ein Foto oder eine PDF wählen"); return null; }
    try{ const data=await compressImage(file); const b={ typ:"image/jpeg", data, name:(file.name||"Beleg").replace(/\.\w+$/,"")+".jpg", size:Math.round(data.length*.75) }; OCR_SRC.set(b, file); return b; }
    catch(e){ toast("Dieses Bildformat kann nicht gelesen werden"); return null; }
  }

  let belegCb=null;
  function belegInputs(){
    if($("#belegCam")) return;
    document.body.insertAdjacentHTML("beforeend", `<input type="file" id="belegCam" accept="image/*" capture="environment" hidden><input type="file" id="belegFile" accept="image/*,application/pdf,.pdf" hidden>`);
    for(const id of ["belegCam","belegFile"]) $("#"+id).onchange = async e => { const f=e.target.files?.[0]; e.target.value=""; if(!f || !belegCb) return; const cb=belegCb; belegCb=null;
      const b=await fileToBeleg(f); if(b) cb(b); };
  }
  function pickBeleg(cb, withoutOpt){
    belegInputs();
    const opts=[{label:"Foto aufnehmen", sub:"Kamera öffnen und Beleg abfotografieren", k:"cam"},{label:"Foto oder PDF auswählen", sub:"Aus Fotos, Dateien oder iCloud Drive", k:"file"}];
    if(withoutOpt) opts.push({label:"Mehrere Belege auf einmal", sub:"Fotos oder PDFs auswählen – werden nacheinander ausgelesen", k:"multi"},{label:"Ohne Beleg erfassen", sub:"Nur Betrag und Lieferant eintragen", k:"none"});
    openPicker("Beleg erfassen", opts, o => { if(o.k==="none") return cb(null); if(o.k==="multi") return pickMulti(); belegCb=cb; $(o.k==="cam"?"#belegCam":"#belegFile").click(); });
  }
  const newAusgabe = (auftragId="") => pickBeleg(b => openAusgabe(null, {beleg:b, auftragId}), true);

  function belegPreviewHtml(b){
    if(!b) return `<button type="button" class="bslot" id="aAdd">${ico.cam}<b>Beleg fotografieren oder hochladen</b><small>Foto oder PDF – optional</small></button>`;
    const pdf=b.typ==="application/pdf";
    return `<div class="bprev${pdf?" pdf":""}">${pdf?`<div class="bpdf">${ico.doc}<b>${esc(b.name||"Beleg.pdf")}</b><small>PDF · ${kbTxt(b.size||b.data.length*.75)}</small></div>`:`<img src="${b.data}" alt="Beleg-Foto" id="aImg">`}
      <div class="bact"><button type="button" class="btn ghost sm" id="aOpen">${ico.preview} Ansehen</button><button type="button" class="btn ghost sm" id="aRep">${ico.cam} Ersetzen</button><button type="button" class="btn ghost sm" id="aDelB">Entfernen</button></div></div>`;
  }
  /* Beleg im Vollbild: Fotos mit Zoom, PDFs als echte Seiten (pdf.js) – optional mit Eingabefeldern unten */
  async function pdfDoc(dataUrl){
    await withTimeout(loadScript(OCR_CDN.pdf), 30000, "PDF-Anzeige lädt nicht");
    const pdfjs=window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc=OCR_CDN.pdfWorker;
    return pdfjs.getDocument({data:dataUrlBytes(dataUrl)}).promise;
  }
  async function pdfThumb(dataUrl, w=120){
    const doc=await pdfDoc(dataUrl), pg=await doc.getPage(1), v1=pg.getViewport({scale:1}), vp=pg.getViewport({scale:w*2/v1.width});
    const c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height; const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height);
    await pg.render({canvasContext:g, viewport:vp}).promise; return c.toDataURL("image/jpeg",.8);
  }
  function showBeleg(b, opts={}){
    if(!b) return;
    const pdf=b.typ==="application/pdf", ov=document.createElement("div"); ov.className="bfull"; let zoom=1, u=null;
    if(pdf) u=URL.createObjectURL(dataUrlBlob(b.data));
    const f=opts.fields;
    ov.innerHTML=`<div class="bfbar"><b>${esc(opts.title||b.name||"Beleg")}</b>
        <button class="bfz" data-z="-1" aria-label="Verkleinern">−</button><button class="bfz" data-z="1" aria-label="Vergrößern">+</button>
        ${pdf?`<a class="bfz txt" href="${u}" target="_blank" rel="noopener" download="${esc(b.name||"Beleg.pdf")}" aria-label="In anderer App öffnen">${ico.dl}</a>`:""}
        <button class="btn ghost sm" data-x>Fertig</button></div>
      <div class="bfimg" id="bfBody"><div class="bfpages" id="bfPages">${pdf?`<div class="bfload"><span class="ocrspin"></span> PDF wird geladen …</div>`:`<img src="${b.data}" alt="Beleg">`}</div></div>
      ${f?`<div class="bfedit"><label><span>Brutto €</span><input data-q="brutto" inputmode="decimal" placeholder="0,00" value="${f.brutto>0?f.brutto.toFixed(2).replace(".",","):""}"></label>
        <label><span>Datum</span><input data-q="datum" type="date" value="${esc(f.datum||"")}"></label>
        <label class="wide"><span>Händler</span><input data-q="lieferant" placeholder="Händler / Lieferant" value="${esc(f.lieferant||"")}"></label>
        <label class="wide"><span>Notiz</span><input data-q="notiz" placeholder="z. B. Display S22" value="${esc(f.notiz||"")}"></label></div>`:""}`;
    const pages=$("#bfPages", ov);
    const setZoom=z=>{ zoom=Math.max(1, Math.min(4, z)); pages.style.width=(zoom*100)+"%"; ov.classList.toggle("zoomed", zoom>1); };
    const close=()=>{ if(u) setTimeout(()=>URL.revokeObjectURL(u),1000); ov.remove(); document.removeEventListener("keydown", esc_); opts.onClose?.(); };
    const esc_=e=>{ if(e.key==="Escape") close(); };
    ov.onclick=e=>{ if(e.target.closest("[data-x]")) return close(); const z=e.target.closest("[data-z]"); if(z) setZoom(zoom*(+z.dataset.z>0?1.5:1/1.5)); };
    $$("img", pages).forEach(im=>im.ondblclick=()=>setZoom(zoom>1?1:2));
    if(f) ov.addEventListener("input", e=>{ const q=e.target.dataset.q; if(!q) return; opts.onEdit?.(q, q==="brutto" ? r2(parseNum(e.target.value)||0) : e.target.value.trim()); });
    document.addEventListener("keydown", esc_);
    document.body.appendChild(ov);
    if(f && opts.focus) setTimeout(()=>{ const el=$(`[data-q="${opts.focus}"]`, ov); if(el && !el.value) el.focus({preventScroll:true}); }, 350);
    if(pdf){
      (async()=>{
        try{ const doc=await pdfDoc(b.data); if(!ov.isConnected) return; pages.innerHTML="";
          const n=Math.min(doc.numPages, 12), w=Math.min(1600, (ov.clientWidth||400)*(window.devicePixelRatio||2)*1.5);
          for(let p=1;p<=n;p++){ const pg=await doc.getPage(p), v1=pg.getViewport({scale:1}), vp=pg.getViewport({scale:w/v1.width});
            const c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height; c.className="bfpage";
            const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); pages.appendChild(c);
            await pg.render({canvasContext:g, viewport:vp}).promise; if(!ov.isConnected) return; }
          if(doc.numPages>n) pages.insertAdjacentHTML("beforeend", `<div class="bfload">… ${doc.numPages-n} weitere Seiten – über ${ico.dl} öffnen</div>`);
        }catch(e){ if(ov.isConnected) pages.innerHTML=`<iframe src="${u}" title="Beleg"></iframe>`; }
      })();
    }
  }

  function dataUrlBlob(d){ const [h,b64]=d.split(","); const typ=(h.match(/data:([^;]+)/)||[])[1]||"application/octet-stream"; const bin=atob(b64); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new Blob([u],{type:typ}); }

  function openAusgabe(id, opt={}){
    const x = id ? S.ausgaben.find(a=>a.id===id) : null;
    const lastKat = S.ausgaben.slice().sort((a,b)=>(b.created||"").localeCompare(a.created||""))[0]?.kategorie;
    const d = x ? {...x} : { id:uid(), datum:today(), lieferant:"", belegNr:"", brutto:"", satz:19, kategorie:lastKat||"Ersatzteile", auftragId:opt.auftragId||"", notiz:"", created:nowStamp() };
    let beleg = opt.beleg!==undefined ? opt.beleg : null, belegChanged = opt.beleg!==undefined;
    const lief=[...new Set(S.ausgaben.map(a=>a.lieferant).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
    const jobs=[...S.auftraege].sort((a,b)=>(b.created||"").localeCompare(a.created||""));
    const jOpts=jobs.map(a=>`<option value="${a.id}" ${d.auftragId===a.id?"selected":""}>#${esc(a.nr)} · ${esc(a.geraet||"Gerät")}${a.kundeId?" · "+esc(kName(a.kundeId)):""}</option>`).join("");
    openSheet(x?"Ausgabe":"Neue Ausgabe", `
      <div id="aPrev">${belegPreviewHtml(beleg)}</div>
      <div class="ocrbar" id="aOcr" hidden aria-live="polite"></div>
      <div class="dupwarn" id="aDup" hidden role="alert"></div>
      <div class="group"><span class="glabel">Beleg</span><div class="box">
        <div class="field"><label for="aLief">Lieferant / Händler</label><input id="aLief" list="aLiefList" placeholder="z. B. Mobilesentrix" value="${esc(d.lieferant)}" autocomplete="off"></div>
        <datalist id="aLiefList">${lief.map(l=>`<option value="${esc(l)}">`).join("")}</datalist>
        <div class="field"><label for="aDatum">Datum</label><input id="aDatum" type="date" value="${d.datum}"></div>
        <div class="field"><label for="aNr">Rechnungs-Nr.</label><input id="aNr" class="mono" placeholder="optional" value="${esc(d.belegNr)}"></div>
        <div class="field"><label for="aBrutto">Bruttobetrag €</label><input id="aBrutto" class="num" inputmode="decimal" placeholder="0,00" value="${d.brutto!==""?numIn(d.brutto):""}"></div>
      </div></div>
      <div class="group"><span class="glabel">MwSt.-Satz auf dem Beleg</span>
        <div class="seg" id="aSatz">${SAETZE.map(p=>`<button type="button" data-satz="${p}" aria-pressed="${+d.satz===p}">${p} %</button>`).join("")}</div>
        <div class="asplit" id="aSplit"></div></div>
      <div class="group"><span class="glabel">Zuordnung</span><div class="box">
        <div class="field"><label for="aKat">Kategorie</label><select id="aKat">${AKAT.map(k=>`<option ${d.kategorie===k?"selected":""}>${k}</option>`).join("")}</select></div>
        <div class="field"><label for="aJob">Auftrag</label><select id="aJob"><option value="">Kein Auftrag</option>${jOpts}</select></div>
        <div class="field stack"><label for="aNotiz">Notiz</label><input id="aNotiz" placeholder="optional, z. B. Display für Kundengerät" value="${esc(d.notiz)}"></div>
      </div>
      <p class="help">Mit einem Auftrag verknüpft, erscheinen die Kosten im Auftrag unter „Material &amp; Einkäufe“.</p></div>
      ${x?`<button class="btn danger" id="aDel">Ausgabe löschen</button><div id="delConfirm"></div>`:""}`,
      () => {
        const brutto=parseNum(val("aBrutto")), lieferant=val("aLief");
        dupCheck(); if(dupHit && !dupOk){ const b=$("#aDup"); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); b.scrollIntoView({block:"center", behavior:"smooth"});
          toast("Möglicherweise doppelt – bitte bestätigen oder abbrechen"); return false; }
        if(!lieferant){ toast("Bitte Lieferant / Händler eintragen"); $("#aLief").focus(); return false; }
        if(!(brutto>0)){ toast("Bitte den Bruttobetrag eintragen"); $("#aBrutto").focus(); return false; }
        const o={...d, lieferant, belegNr:val("aNr"), datum:val("aDatum")||today(), brutto:r2(brutto), satz:+d.satz, kategorie:val("aKat"), auftragId:val("aJob"), notiz:val("aNotiz")};
        if(beleg && ocrText) o.ocrText=ocrText; else if(!beleg) delete o.ocrText;
        if(belegChanged){
          if(beleg){ o.bild=true; o.bildTyp=beleg.typ; o.bildName=beleg.name; o.bildLokal = mode==="db" && beleg.data.length>DB_IMG_MAX; }
          else { o.bild=false; delete o.bildTyp; delete o.bildName; delete o.bildLokal; }
        }
        save("ausgaben", o);
        if(belegChanged){ if(beleg) BILD.put(o.id, beleg).then(ok=>{ if(!ok && mode==="db") toast("Beleg nur auf diesem Gerät gespeichert"); }); else if(x?.bild) BILD.del(o.id); }
        UI.ausMonth=o.datum.slice(0,7);
        toast(x?"Ausgabe gespeichert":`Ausgabe erfasst: ${eur(o.brutto)}`);
      }, x?"Sichern":"Speichern");
    const split=()=>{ const c=aCalc({brutto:parseNum(val("aBrutto")), satz:d.satz});
      $("#aSplit").innerHTML = c.p ? `<span>Netto <b class="num">${eur(c.netto)}</b></span><span>${S.firma.kleinunternehmer?"darin MwSt.":"Vorsteuer"} <b class="num">${eur(c.vst)}</b></span>` : `<span>Ohne MwSt. – z. B. Porto, Privatverkauf, Kleinunternehmer</span>`; };
    split(); $("#aBrutto").oninput=split;
    const touched=new Set(); let ocrTok=0, ocrText=x?.ocrText||"";
    let dupHit=null, dupOk=false; const saveLbl = x?"Sichern":"Speichern";
    const dupCheck=()=>{ const box=$("#aDup"); if(!box) return;
      const f=findDupAusgabe({lieferant:val("aLief"), datum:val("aDatum"), nr:val("aNr"), brutto:parseNum(val("aBrutto"))}, x?.id);
      if(!f){ dupHit=null; dupOk=false; box.hidden=true; box.innerHTML=""; }
      else { if(dupHit?.id!==f.hit.id) dupOk=false; dupHit=f.hit; const h=f.hit;
        box.hidden=false;
        box.innerHTML=`<div class="dw-h">⚠︎ Schon erfasst?</div>
          <div class="dw-b"><b>${esc(h.lieferant||"Ohne Händler")}</b><span>${deDate(h.datum)} · <b class="num">${eur(h.brutto)}</b></span></div>
          <small>${f.why}${h.belegNr?` · Nr. <span class="mono">${esc(h.belegNr)}</span>`:""}${h.kategorie?` · ${esc(h.kategorie)}`:""}${h.created?` · erfasst am ${deDate(h.created)}`:""}</small>
          <label class="dw-c"><input type="checkbox" id="aDupOk" ${dupOk?"checked":""}><span>Trotzdem als <b>neue</b> Ausgabe speichern</span></label>`;
        $("#aDupOk").onchange=e=>{ dupOk=e.target.checked; updSave(); }; }
      updSave(); };
    const updSave=()=>{ const sb=$("#sSave"); if(!sb || !$("#aDup")) return; const warn=!!dupHit && !dupOk; sb.classList.toggle("dup", warn); sb.textContent = warn ? "Doppelt?" : saveLbl; };
    const setSatz=p=>{ d.satz=p; $$("#aSatz [data-satz]").forEach(z=>z.setAttribute("aria-pressed", +z.dataset.satz===p)); split(); };
    $$("#aSatz [data-satz]").forEach(b=>b.onclick=()=>{ touched.add("aSatz"); $("#aSatz").classList.remove("ocrok","ocrcheck"); setSatz(+b.dataset.satz); });
    const mark=(id,cls)=>{ const f=id==="aSatz"?$("#aSatz"):$("#"+id)?.closest(".field"); if(!f) return; f.classList.remove("ocrok","ocrcheck"); if(cls) f.classList.add(cls); };
    ["aLief","aDatum","aBrutto","aNr"].forEach(id=>{ $("#"+id).addEventListener("input", ()=>dupCheck()); $("#"+id).addEventListener("change", ()=>dupCheck()); });
    ["aLief","aDatum","aBrutto","aNr","aKat","aNotiz"].forEach(id=>{ const el=$("#"+id); const h=()=>{ touched.add(id); mark(id,null); }; el.addEventListener("input",h); el.addEventListener("change",h); });
    const ocrBar=html=>{ const b=$("#aOcr"); if(!b) return; b.hidden=!html; b.innerHTML=html||""; };
    const txtBtn=(ki)=>ocrText?`<button type="button" class="linkbtn" id="aOcrShow" data-l="${ki?"KI-Antwort zeigen":"Erkannten Text zeigen"}">${ki?"KI-Antwort zeigen":"Erkannten Text zeigen"}</button>`:"";
    const bindBar=b=>{ const sh=$("#aOcrShow"); if(sh) sh.onclick=()=>{ const pre=$("#aOcrTxt"); if(pre){ pre.remove(); sh.textContent=sh.dataset.l; } else { sh.insertAdjacentHTML("afterend", `<pre class="ocrtxt" id="aOcrTxt">${esc(ocrText)}</pre>`); sh.textContent="Text ausblenden"; } };
      const re=$("#aOcrGo"); if(re) re.onclick=()=>{ touched.clear(); runOcr(b); }; };
    const ocrIdle=b=>{ if(!b){ ocrBar(""); return; } ocrBar(`<div class="ocrrow idle">${ico.scan}<span><b>Beleg automatisch auslesen${geminiKey()?' <i class="kibadge">KI</i>':""}</b><small>Betrag, Datum, Händler und Rechnungs-Nr. vom Beleg übernehmen</small></span><button type="button" class="btn ghost sm" id="aOcrGo">Auslesen</button></div>${txtBtn()}`); bindBar(b); };
    const runOcr=async (b, opts={})=>{
      if(!b){ ocrTok++; ocrBar(""); return; }
      const tok=++ocrTok, live=()=>tok===ocrTok && !!$("#aOcr");
      let r=null, quelle="lokal", kiHinweis="", kiInfo="";
      if(geminiKey() && !opts.lokal){
        ocrBar(`<div class="ocrrow run ki"><span class="ocrspin" aria-hidden="true"></span><span><b>KI liest den Beleg … <i class="kibadge">KI</i></b><small>Google Gemini sucht Händler, Datum, Rechnungs-Nr., Betrag und MwSt.</small></span></div><div class="ocrprog indet"><i></i></div><small class="ocrnote" id="aKiModel">Verbindung zu Google …</small>`);
        const onModel=(m,n)=>{ const el=$("#aKiModel"); if(el && live()) el.textContent = n ? `Ausweichmodell ${m} wird versucht …` : `Modell ${m} · Sie können währenddessen schon tippen.`; };
        try{ const g=await geminiBeleg(b, onModel); if(!live()) return;
          if(g.betrag||g.datum||g.lieferant||g.nr){ r=g; quelle="ki"; ocrText=g.raw; kiInfo=`${g.model} · ${(g.ms/1000).toFixed(1).replace(".",",")} s${g.tried?.length?` (nach ${g.tried.map(t=>t.model+": "+(GEMINI_MSG[t.code]?.split(" – ")[0]||t.code)).join(", ")})`:""}`; }
          else kiHinweis="Die KI hat auf dem Beleg nichts Eindeutiges gefunden"; }
        catch(e){ if(!live()) return; if(e.code!=="nokey") kiHinweis="KI nicht verfügbar: "+gemMsg(e)+((e.tried||[]).length>1?` (versucht: ${e.tried.map(t=>t.model).join(", ")})`:""); }
      }
      const kiNote = kiHinweis ? `<small class="ocrnote kiwarn">${esc(kiHinweis)} – lokale Texterkennung verwendet.</small>` : "";
      if(!r){
        ocrBar(`<div class="ocrrow run"><span class="ocrspin" aria-hidden="true"></span><span><b>Beleg wird ausgelesen …</b><small id="aOcrMsg">${b.typ==="application/pdf"?"PDF wird geöffnet":"Texterkennung wird gestartet"}</small></span><span class="ocrpct num" id="aOcrPct">0 %</span></div><div class="ocrprog"><i id="aOcrProg"></i></div>${kiNote||`<small class="ocrnote">Läuft auf Ihrem Gerät – Sie können währenddessen schon tippen.</small>`}`);
        const prog=(p,msg)=>{ if(!live()) return; const pc=Math.max(0,Math.min(100,Math.round(p*100))); const a=$("#aOcrPct"), g=$("#aOcrProg"), m=$("#aOcrMsg"); if(a) a.textContent=pc+" %"; if(g) g.style.width=pc+"%"; if(msg&&m) m.textContent=msg; };
        let res;
        try{ res=await ocrBeleg(b, prog); }
        catch(e){ if(!live()) return; ocrBar(`<div class="ocrrow err">${ico.scan}<span><b>Automatisches Auslesen nicht möglich</b><small>${navigator.onLine===false?"Keine Internetverbindung – die Texterkennung wird beim ersten Mal geladen.":"Die Texterkennung konnte nicht gestartet werden."} Bitte Betrag und Datum von Hand eintragen.</small></span><button type="button" class="btn ghost sm" id="aOcrGo">Nochmal</button></div>${kiNote}`); bindBar(b); return; }
        if(!live()) return;
        ocrText=(res.text||"").trim().slice(0,4000);
        r=ocrExtract(res.text, lief, [S.firma.name, S.firma.ansprechpartner, "RepairMobile"]);
      }
      const got=[]; let check=false;
      if(r.betrag && !touched.has("aBrutto")){ $("#aBrutto").value=r.betrag.v.toFixed(2).replace(".",","); mark("aBrutto", r.betrag.sicher?"ocrok":"ocrcheck"); check ||= !r.betrag.sicher; got.push(`<b class="num">${eur(r.betrag.v)}</b>`); }
      if(r.datum && !touched.has("aDatum")){ $("#aDatum").value=r.datum.iso; mark("aDatum", r.datum.sicher?"ocrok":"ocrcheck"); check ||= !r.datum.sicher; got.push(deDate(r.datum.iso)); }
      if(r.lieferant && !touched.has("aLief") && !val("aLief")){ $("#aLief").value=r.lieferant.name; mark("aLief", r.lieferant.sicher?"ocrok":"ocrcheck"); check ||= !r.lieferant.sicher; got.push(esc(r.lieferant.name)+(r.lieferant.quelle==="verkaeufer"?" <small>(Verkäufer)</small>":"")); }
      if(r.nr && !touched.has("aNr") && !val("aNr")){ $("#aNr").value=r.nr.nr; mark("aNr", r.nr.sicher?"ocrok":"ocrcheck"); check ||= !r.nr.sicher; got.push(`Nr. <span class="mono">${esc(r.nr.nr)}</span>`); }
      if(r.satz!=null && !touched.has("aSatz")){ setSatz(r.satz); mark("aSatz","ocrok"); got.push(`${r.satz} % MwSt.`); }
      if(r.kategorie && !touched.has("aKat")){ $("#aKat").value=r.kategorie; mark("aKat","ocrok"); got.push(esc(r.kategorie)); }
      if(r.notiz && !touched.has("aNotiz") && !val("aNotiz")){ $("#aNotiz").value=r.notiz; mark("aNotiz","ocrok"); got.push(`„${esc(r.notiz)}“`); }
      split(); dupCheck();
      const fehlt=[!r.betrag&&"Betrag", !r.datum&&"Datum"].filter(Boolean);
      const ok=got.length>0, ki=quelle==="ki";
      const title = ok ? (ki?`Von der KI erkannt <i class="kibadge">KI</i>`:"Automatisch erkannt") : "Nichts Eindeutiges erkannt";
      ocrBar(`<div class="ocrrow ${ok?(check||fehlt.length?"warn":"ok"):"err"}${ki?" ki":""}">${ok?ico.check:ico.scan}<span><b>${title}</b><small>${ok?got.join(" · "):"Der Text war zu undeutlich."}${fehlt.length&&ok?` – ${fehlt.join(" und ")} bitte selbst eintragen`:""}${check?" – <u>gelb markierte</u> Werte bitte prüfen":""}${!ok?" Bitte von Hand eintragen.":""}</small></span><button type="button" class="btn ghost sm" id="aOcrGo">Neu lesen</button></div>${kiNote}${ki?`<small class="ocrnote">${esc(kiInfo)} · Bitte kurz gegenprüfen – auch KI kann sich verlesen.</small>`:""}${txtBtn(ki)}`);
      bindBar(b);
    };
    const bindPrev=()=>{
      $("#aPrev").innerHTML=belegPreviewHtml(beleg);
      const set=b=>{ beleg=b; belegChanged=true; ocrText=""; bindPrev(); runOcr(b); };
      const add=$("#aAdd"); if(add) add.onclick=()=>pickBeleg(set);
      const rep=$("#aRep"); if(rep) rep.onclick=()=>pickBeleg(set);
      const op=$("#aOpen"); if(op) op.onclick=()=>showBeleg(beleg);
      const im=$("#aImg"); if(im) im.onclick=()=>showBeleg(beleg);
      const db=$("#aDelB"); if(db) db.onclick=()=>{ beleg=null; belegChanged=true; ocrText=""; bindPrev(); runOcr(null); };
    };
    bindPrev();
    if(belegChanged && beleg) runOcr(beleg);
    if(x?.bild && !belegChanged){ $("#aPrev").innerHTML=`<div class="bslot loading">${ico.doc}<small>Beleg wird geladen …</small></div>`;
      BILD.get(x.id).then(b=>{ if(!$("#aPrev") || belegChanged) return; beleg=b; if(!b) $("#aPrev").innerHTML=`<div class="bslot">${ico.doc}<b>Beleg nicht auf diesem Gerät</b><small>${x.bildLokal?"Er wurde auf einem anderen Gerät erfasst (zu groß für die Synchronisierung).":"Er konnte nicht geladen werden."}</small></div>`; else { bindPrev(); ocrIdle(b); } }); }
    const del=$("#aDel"); if(del) del.onclick=()=>confirmBox(`Ausgabe von ${esc(x.lieferant)} über ${eur(x.brutto)} löschen?`, ()=>{ remove("ausgaben",x.id); if(x.bild) BILD.del(x.id); closeSheet(); toast("Ausgabe gelöscht"); });
  }

  function ausCard(x){
    const c=aCalc(x), job=x.auftragId?S.auftraege.find(a=>a.id===x.auftragId):null;
    return `<button class="card acard" data-aus="${x.id}">
      <span class="athumb${x.bild?"":" none"}" ${x.bild?`data-thumb="${x.id}"`:""} style="--kc:${AKAT_C[x.kategorie]||"#98a2ad"}">${x.bild?(x.bildTyp==="application/pdf"?"PDF":""):ico.doc}</span>
      <span class="abody"><span class="row"><h3>${esc(x.lieferant||"Ohne Lieferant")}</h3><strong class="num">${eur(c.brutto)}</strong></span>
      <span class="meta"><span class="kdot" style="--kc:${AKAT_C[x.kategorie]||"#98a2ad"}">${esc(x.kategorie||"Sonstiges")}</span>${job?`<span class="mono jobnr">#${esc(job.nr)}</span>`:""}<span>${c.p} % MwSt.</span>${x.belegNr?`<span class="mono">${esc(x.belegNr)}</span>`:""}</span></span></button>`;
  }
  function vAusgaben(seg){
    if(!UI.ausMonth) UI.ausMonth=today().slice(0,7);
    const ym=UI.ausMonth, list=ausIn(ym);
    const [y,m]=ym.split("-").map(Number); const pv=new Date(y,m-2,1), prev=`${pv.getFullYear()}-${pad(pv.getMonth()+1)}`;
    const tot=list.reduce((s,x)=>{ const c=aCalc(x); s.b+=c.brutto; s.n+=c.netto; s.v+=c.vst; return s; },{b:0,n:0,v:0});
    const prevSum=ausIn(prev).reduce((s,x)=>s+aCalc(x).brutto,0);
    const diff = prevSum ? Math.round((tot.b-prevSum)/prevSum*100) : null;
    const byKat=AKAT.map(k=>[k, list.filter(x=>(x.kategorie||"Sonstiges")===k).reduce((s,x)=>s+aCalc(x).brutto,0)]).filter(z=>z[1]>0).sort((a,b)=>b[1]-a[1]);
    const jobSum=list.filter(x=>x.auftragId).reduce((s,x)=>s+aCalc(x).brutto,0);
    const head=`<div class="calhead"><h2>${monthLabel(ym)}</h2><button class="navbtn" data-am="-1" aria-label="Voriger Monat">${ico.left}</button><button class="btn ghost sm" data-am="0">Heute</button><button class="navbtn" data-am="1" aria-label="Nächster Monat">${ico.right}</button></div>`;
    const summary=`<div class="card asum">
        <div class="row"><span class="lbl">Ausgaben ${MONTHS[m-1]}</span>${diff!=null?`<span class="adiff ${diff>0?"up":"down"}">${diff>0?"+":""}${diff} % zum Vormonat</span>`:""}</div>
        <div class="abig num">${eur(tot.b)}</div>
        <div class="asub"><span>Netto <b class="num">${eur(tot.n)}</b></span><span>${S.firma.kleinunternehmer?"darin MwSt.":"Vorsteuer"} <b class="num">${eur(tot.v)}</b></span><span>${list.length} Beleg${list.length===1?"":"e"}</span></div>
        ${byKat.length?`<div class="kbar" role="img" aria-label="Ausgaben nach Kategorie">${byKat.map(([k,v])=>`<i style="flex:${v};background:${AKAT_C[k]}" title="${esc(k)}"></i>`).join("")}</div>
        <div class="klist">${byKat.map(([k,v])=>`<div><span class="kdot" style="--kc:${AKAT_C[k]}">${esc(k)}</span><span class="num">${eur(v)}</span><small>${Math.round(v/tot.b*100)} %</small></div>`).join("")}</div>`:""}
        ${jobSum?`<div class="meta" style="margin-top:2px">${ico.phone} ${eur(jobSum)} davon Aufträgen zugeordnet</div>`:""}
      </div>`;
    const actions=`<div class="btnrow"><button class="btn accent" data-act="newAus">${ico.cam} Beleg erfassen / scannen</button><button class="btn ghost" data-act="multiAus">${ico.plus} Mehrere Belege</button>${S.ausgaben.length?`<button class="btn ghost" data-act="ausExport">${ico.dl} Export ▾</button>`:""}</div>`;
    if(!S.ausgaben.length) return `${seg}${hintHtml("ausgaben","<b>Ausgaben &amp; Einkäufe.</b> Fotografieren Sie Eingangsrechnungen und Quittungen direkt mit dem iPhone. Betrag, MwSt. und Kategorie tragen Sie kurz ein – fertig für den Steuerberater.")}
      <div class="empty">${bigIcon()}<h2>Noch keine Ausgaben</h2><p>Tippen Sie auf „Beleg erfassen“, fotografieren Sie die Quittung oder wählen Sie eine PDF-Rechnung Ihres Lieferanten.</p>
      <div class="btnrow" style="justify-content:center"><button class="btn accent" data-act="newAus">${ico.cam} Beleg erfassen / scannen</button><button class="btn ghost" data-act="multiAus">${ico.plus} Mehrere Belege erfassen</button></div></div>`;
    let html=`${seg}${head}${summary}${actions}`, last=null;
    if(!list.length) return html+`<div class="empty" style="padding:24px 16px"><p>Keine Ausgaben im ${MONTHS[m-1]}.</p></div>`;
    for(const x of list){ if(x.datum!==last){ html+=`<div class="daylabel">${longDate(x.datum)}</div>`; last=x.datum; } html+=ausCard(x); }
    return html;
  }
  function fillThumbs(root=document){
    $$("[data-thumb]", root).forEach(async el=>{ if(el.dataset.done) return; el.dataset.done="1"; const id=el.dataset.thumb;
      const r=S.ausgaben.find(a=>a.id===id); if(r?.bildTyp==="application/pdf") return;
      const b=await BILD.get(id); if(b && b.typ!=="application/pdf"){ el.style.backgroundImage=`url("${b.data}")`; el.classList.add("img"); } else if(!b){ el.classList.add("none"); el.innerHTML=ico.doc; } });
  }

  /* Ausgaben im Auftrag */
  function jobAusHtml(a){
    const list=S.ausgaben.filter(x=>x.auftragId===a.id); const sum=list.reduce((s,x)=>s+aCalc(x).brutto,0), erl=sumPos(a.positionen);
    return `<div class="group"><span class="glabel">Material &amp; Einkäufe</span>
      ${list.map(ausCard).join("")}
      ${list.length?`<div class="box"><div class="kv"><span>Einkauf gesamt</span><span class="num">${eur(sum)}</span></div>${erl?`<div class="kv"><span>Rohertrag (Positionen − Einkauf)</span><span class="num ${erl-sum<0?"c-red":"c-green"}">${eur(erl-sum)}</span></div>`:""}</div>`:""}
      <button class="btn ghost" id="jobAus">${ico.cam} Einkauf / Beleg zuordnen</button></div>`;
  }

  /* Export */
  function ausCsvText(rows){
    const cell=v=>{ const s=String(v??""); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const head=["Datum","Lieferant","Rechnungs-Nr.","Kategorie","Netto (EUR)","MwSt-Satz (%)","Vorsteuer (EUR)","Brutto (EUR)","Auftrag","Notiz","Beleg-Datei"];
    const lines=[head, ...rows.map(x=>{ const c=aCalc(x), j=x.auftragId?S.auftraege.find(a=>a.id===x.auftragId):null;
      return [deDate(x.datum), x.lieferant, x.belegNr||"", x.kategorie||"", num2(c.netto), num2(c.p), num2(c.vst), num2(c.brutto), j?j.nr:"", x.notiz||"", x.bild?belegFileName(x):""]; })];
    const t=rows.reduce((s,x)=>{ const c=aCalc(x); s.n+=c.netto; s.v+=c.vst; s.b+=c.brutto; return s; },{n:0,v:0,b:0});
    lines.push(["Summe","","","",num2(t.n),"",num2(t.v),num2(t.b),"","",""]);
    return "﻿"+lines.map(l=>l.map(cell).join(";")).join("\r\n")+"\r\n";
  }
  function belegFileName(x){ const ext=x.bildTyp==="application/pdf"?"pdf":"jpg"; return `${x.datum}_${safeName(x.lieferant).slice(0,40)}_${num2(x.brutto)}_${x.id.slice(-4)}.${ext}`; }
  const ausRowsFor = pre => S.ausgaben.filter(x=>(x.datum||"").startsWith(pre)).sort((a,b)=>(a.datum||"").localeCompare(b.datum||""));
  function exportAusCsv(pre){
    const rows=ausRowsFor(pre); if(!rows.length){ toast("Keine Ausgaben in diesem Zeitraum"); return; }
    saveFile(`repairmobile-ausgaben-${pre}.csv`, new Blob([ausCsvText(rows)],{type:"text/csv;charset=utf-8"}), `CSV mit ${rows.length} Ausgabe${rows.length===1?"":"n"} bereit`);
  }
  async function exportPaket(pre, withInvoices){
    if(!window.JSZip){ toast("ZIP-Erstellung nicht verfügbar"); return; }
    const rows=ausRowsFor(pre); const inv=withInvoices ? S.rechnungen.filter(r=>dTyp(r)==="rechnung" && r.nr && dStatus(r)!=="entwurf" && (r.datum||"").startsWith(pre)).sort((a,b)=>(a.datum||"").localeCompare(b.datum||"")) : [];
    if(!rows.length && !inv.length){ toast("Nichts in diesem Zeitraum"); return; }
    toast("Paket wird erstellt …");
    const zip=new window.JSZip(); let fehlt=0;
    if(rows.length) zip.file(`Ausgaben-${pre}.csv`, ausCsvText(rows));
    if(inv.length) zip.file(`Rechnungen-${pre}.csv`, docsCsvText(inv));
    for(const x of rows){ if(!x.bild) continue; const b=await BILD.get(x.id); if(!b){ fehlt++; continue; } zip.file("Belege/"+belegFileName(x), b.data.split(",")[1], {base64:true}); }
    const blob=await zip.generateAsync({type:"blob", compression:"DEFLATE"});
    const ok=await saveFile(`repairmobile-${withInvoices?"buchhaltung":"ausgaben"}-${pre}.zip`, blob, `ZIP bereit: ${rows.length} Ausgaben${inv.length?`, ${inv.length} Rechnungen`:""}`);
    if(ok && fehlt) setTimeout(()=>toast(`${fehlt} Beleg${fehlt===1?"":"e"} nicht auf diesem Gerät – nur in der CSV`),2600);
  }
  function ausExportMenu(){
    const ym=UI.ausMonth, y=ym.slice(0,4), n=ausIn(ym).length, ny=ausIn(y).length;
    openPicker("Ausgaben exportieren", [
      {label:`CSV – ${monthLabel(ym)}`, sub:`${n} Ausgabe${n===1?"":"n"} · Tabelle für Excel / Steuerberater`, k:"csvM"},
      {label:`ZIP mit Belegen – ${monthLabel(ym)}`, sub:"CSV plus alle Belegfotos und PDFs", k:"zipM"},
      {label:`CSV – ganzes Jahr ${y}`, sub:`${ny} Ausgabe${ny===1?"":"n"}`, k:"csvY"},
      {label:`ZIP mit Belegen – Jahr ${y}`, sub:"CSV plus alle Belegfotos und PDFs", k:"zipY"}],
      o => { const pre=o.k.endsWith("M")?ym:y; o.k.startsWith("csv") ? exportAusCsv(pre) : exportPaket(pre,false); });
  }

  /* ---------- Mehrere Belege auf einmal (Stapelerfassung) ---------- */
  const BATCH_MAX = 30;
  let BT = null;   // { rows:[], tok, running, noKi, kiNote }
  function pickMulti(){
    let inp=$("#belegMulti");
    if(!inp){ document.body.insertAdjacentHTML("beforeend", `<input type="file" id="belegMulti" accept="image/*,application/pdf,.pdf" multiple hidden>`); inp=$("#belegMulti");
      inp.onchange = e => { const files=[...(e.target.files||[])]; e.target.value=""; if(files.length) openBatch(files); }; }
    inp.click();
  }
  const btStatus = { wait:["Wartet",""], read:["Wird gelesen …","run"], ki:["KI","ki"], lokal:["Lokal gelesen","lok"], err:["Nicht gelesen","err"] };
  /* Duplikat-Prüfung (Einzelscan + Stapel): gleiche Rechnungs-Nr. ODER Händler + Datum + Betrag identisch */
  const nrKey = v => String(v||"").replace(/[\s\-_/.:#]/g,"").toLowerCase();
  function findDupAusgabe(d, exclude){
    const nr=nrKey(d.nr), lf=ocrNorm(d.lieferant), br=+d.brutto||0;
    for(const x of S.ausgaben){
      if(x.id===exclude) continue;
      const xl=ocrNorm(x.lieferant);
      // gleiche Rechnungs-Nr. – bei kurzen Nummern (z. B. Bon „4711“) nur, wenn der Händler nicht eindeutig ein anderer ist
      if(nr.length>=3 && nrKey(x.belegNr)===nr && (nr.length>=8 || !lf || !xl || lf===xl || lf.includes(xl) || xl.includes(lf))) return {hit:x, why:"Gleiche Rechnungs-Nr."};
      if(br>0 && lf && Math.abs((+x.brutto||0)-br)<0.005 && x.datum===d.datum && xl===lf) return {hit:x, why:"Gleicher Händler, Datum und Betrag"};
    }
    return null;
  }
  function btDup(r){
    const d=r.d;
    const f=findDupAusgabe(d); const hit=f?.hit;
    if(hit) return `Schon erfasst? ${esc(hit.lieferant)} · ${deDate(hit.datum)} · ${eur(hit.brutto)}`;
    if(!(d.brutto>0)) return null;
    const twin=BT.rows.find(o=>o!==r && o.on && o.d.brutto===d.brutto && o.d.datum===d.datum && ocrNorm(o.d.lieferant)===ocrNorm(d.lieferant) && d.lieferant);
    return twin && BT.rows.indexOf(twin)<BT.rows.indexOf(r) ? "Doppelt in dieser Auswahl" : null;
  }
  function btRowHtml(r, i){
    const [stL, stC]=btStatus[r.st]; const d=r.d, ready=!["wait","read"].includes(r.st);
    const chk=f=>r.check.has(f)?" bchk":"";
    const dup=ready ? btDup(r) : null;
    const miss=ready && r.on && (!d.lieferant || !(d.brutto>0));
    const tsrc = r.beleg ? (r.beleg.typ==="application/pdf" ? r.thumb : r.beleg.data) : null;
    const thumb = !r.beleg ? `<span class="bthumb none">${ico.doc}</span>` : tsrc ? `<span class="bthumb" style="background-image:url('${tsrc}')">${r.beleg.typ==="application/pdf"?"<i>PDF</i>":""}</span>` : `<span class="bthumb pdf">PDF</span>`;
    return `<div class="brow${r.on?"":" off"}${miss?" miss":""}" data-bi="${i}">
      <div class="bhead"><button type="button" class="bview" data-bview ${r.beleg?"":"disabled"} aria-label="Beleg ansehen">${thumb}<span class="bname"><b>${esc(d.lieferant||r.name)}</b><small>${r.beleg?`${ico.preview} Ansehen · `:""}${esc(r.name)}</small></span></button>
        <span class="bst ${stC}">${r.st==="read"?`<span class="ocrspin" aria-hidden="true"></span>`:""}${stL}</span>
        ${ready?`<label class="bon" title="Übernehmen"><input type="checkbox" data-bf="on" ${r.on?"checked":""}><span>Übernehmen</span></label>`:""}</div>
      ${ready?`<div class="bgrid">
        <label class="wide${chk("lieferant")}"><span>Händler</span><input data-bf="lieferant" value="${esc(d.lieferant)}" placeholder="Pflichtfeld"></label>
        <label class="${chk("datum")}"><span>Datum</span><input type="date" data-bf="datum" value="${d.datum}"></label>
        <label class="${chk("brutto")}"><span>Brutto €</span><input data-bf="brutto" class="num" inputmode="decimal" value="${d.brutto>0?d.brutto.toFixed(2).replace(".",","):""}" placeholder="0,00"></label>
        <label class="${chk("nr")}"><span>Rechnungs-Nr.</span><input data-bf="nr" class="mono" value="${esc(d.nr)}" placeholder="–"></label>
        <label><span>MwSt.</span><select data-bf="satz">${SAETZE.map(p=>`<option value="${p}" ${+d.satz===p?"selected":""}>${p} %</option>`).join("")}</select></label>
        <label class="wide"><span>Kategorie</span><select data-bf="kategorie">${AKAT.map(k=>`<option ${d.kategorie===k?"selected":""}>${k}</option>`).join("")}</select></label>
        <label class="wide"><span>Notiz</span><input data-bf="notiz" value="${esc(d.notiz)}" placeholder="optional"></label>
      </div>${dup?`<div class="bwarn">⚠︎ ${dup}</div>`:""}${r.msg?`<div class="bmsg">${esc(r.msg)}</div>`:""}`:""}
    </div>`;
  }
  function btRender(i){
    if(!BT || !$("#btList")) return;
    if(i==null) $("#btList").innerHTML=BT.rows.map(btRowHtml).join("");
    else { const el=$(`#btList [data-bi="${i}"]`); if(el) el.outerHTML=btRowHtml(BT.rows[i], i); }
    const done=BT.rows.filter(r=>!["wait","read"].includes(r.st)).length, n=BT.rows.length;
    const cur=BT.rows.findIndex(r=>r.st==="read");
    $("#btProgTxt").textContent = BT.running ? `Verarbeite Beleg ${Math.min(done+1,n)} von ${n} …` : `${n} Beleg${n===1?"":"e"} ausgelesen`;
    $("#btProg i").style.width = Math.round((done+(cur>=0?.35:0))/n*100)+"%";
    $("#btProg").classList.toggle("done", !BT.running);
    const sel=BT.rows.filter(r=>r.on && !["wait","read"].includes(r.st));
    const sum=sel.reduce((s,r)=>s+(r.d.brutto||0),0);
    const go=$("#btSave"); if(go){ go.disabled = BT.running || !sel.length; go.innerHTML = BT.running ? `<span class="ocrspin" aria-hidden="true"></span> Belege werden gelesen …` : `${ico.checkc} Alle ${sel.length} Ausgabe${sel.length===1?"":"n"} speichern · ${eur(sum)}`; }
    const note=$("#btNote"); if(note){ note.hidden=!BT.kiNote; note.textContent=BT.kiNote||""; }
  }
  function btFrom(res, check){
    const d={ lieferant:res.lieferant?.name||"", datum:res.datum?.iso||today(), nr:res.nr?.nr||"", brutto:res.betrag?.v||0, satz:res.satz??19, kategorie:res.kategorie||"", notiz:res.notiz||"" };
    if(!res.betrag || !res.betrag.sicher) check.add("brutto"); if(!res.datum || !res.datum.sicher) check.add("datum");
    if(!res.lieferant || !res.lieferant.sicher) check.add("lieferant"); if(res.nr && !res.nr.sicher) check.add("nr");
    return d;
  }
  async function btProcess(tok){
    const lastKat = S.ausgaben.slice().sort((a,b)=>(b.created||"").localeCompare(a.created||""))[0]?.kategorie || "Ersatzteile";
    const known=[...new Set(S.ausgaben.map(a=>a.lieferant).filter(Boolean))], own=[S.firma.name, S.firma.ansprechpartner, "RepairMobile"];
    for(let i=0;i<BT.rows.length;i++){
      if(!BT || BT.tok!==tok) return;
      const r=BT.rows[i]; r.st="read"; btRender(i);
      try{
        r.beleg = await fileToBeleg(r.file);
        if(!r.beleg) throw new Error("Datei nicht lesbar (Foto oder PDF wählen)");
        if(r.beleg.typ==="application/pdf") pdfThumb(r.beleg.data).then(t=>{ r.thumb=t; const el=$(`#btList [data-bi="${i}"] .bthumb`); if(el){ el.classList.remove("pdf"); el.style.backgroundImage=`url('${t}')`; el.innerHTML="<i>PDF</i>"; } }).catch(()=>{});
        let res=null;
        if(geminiKey() && !BT.noKi){
          try{ res=await geminiBeleg(r.beleg); r.src="ki"; r.ocrText=res.raw; }
          catch(e){ if(["quota","key","disabled","region","offline","nokey","net"].includes(e.code)){ BT.noKi=true; BT.kiNote=`KI nicht verfügbar (${gemMsg(e).split(" – ")[0]}) – die übrigen Belege werden lokal gelesen.`; }
            r.msg="KI: "+gemMsg(e).split(" – ")[0]+" – lokal gelesen"; }
        }
        if(!res){ const o=await ocrBeleg(r.beleg); res=ocrExtract(o.text, known, own); r.src="lokal"; r.ocrText=(o.text||"").slice(0,4000); }
        if(!BT || BT.tok!==tok) return;
        r.d=btFrom(res, r.check); if(!r.d.kategorie) r.d.kategorie=lastKat;
        if(!res.lieferant && !res.betrag && !res.datum) r.msg=(r.msg?r.msg+" · ":"")+"Nichts erkannt – bitte von Hand ausfüllen";
        r.st=r.src;
        if(btDup(r)){ r.on=false; r.msg=(r.msg?r.msg+" · ":"")+"Automatisch abgewählt – zum Übernehmen Häkchen setzen"; }
      }catch(e){ if(!BT || BT.tok!==tok) return; r.st="err"; r.msg=e.message||"Fehler"; r.d={lieferant:"", datum:today(), nr:"", brutto:0, satz:19, kategorie:lastKat, notiz:""}; ["brutto","lieferant"].forEach(f=>r.check.add(f)); }
      btRender(i);
    }
    if(!BT || BT.tok!==tok) return;
    BT.running=false; btRender();
    const n=BT.rows.filter(r=>r.st==="err").length, p=BT.rows.filter(r=>r.on && (!r.d.lieferant || !(r.d.brutto>0))).length;
    toast(n ? `${n} Beleg${n===1?"":"e"} nicht lesbar – bitte prüfen` : p ? `${p} Beleg${p===1?"":"e"} unvollständig – rot markiert` : "Alle Belege ausgelesen – bitte kurz prüfen");
  }
  function openBatch(files){
    if(files.length>BATCH_MAX){ toast(`Höchstens ${BATCH_MAX} Belege auf einmal – die ersten ${BATCH_MAX} werden gelesen`); files=files.slice(0,BATCH_MAX); }
    BT={ rows:files.map(f=>({file:f, name:f.name||"Beleg", st:"wait", on:true, check:new Set(), d:{}, msg:""})), tok:Date.now(), running:true, noKi:false, kiNote:"" };
    openSheet(`Mehrere Belege <small>${files.length}</small>`, `
      <div class="btprog"><div class="btprogrow"><b id="btProgTxt">Verarbeite Beleg 1 von ${files.length} …</b><span class="kibadge" ${geminiKey()?"":"hidden"}>KI</span></div>
        <div class="ocrprog" id="btProg"><i></i></div>
        <small class="ocrnote">${geminiKey()?"Google Gemini liest die Belege nacheinander aus.":"Die Belege werden auf dem Gerät ausgelesen (für KI-Erkennung Gemini-Key unter Firmendaten eintragen)."} Werte lassen sich gleich hier anpassen.</small>
        <small class="ocrnote kiwarn" id="btNote" hidden></small></div>
      <div id="btList" class="btlist"></div>
      <p class="help">Gelb = bitte prüfen · Rot = Händler oder Betrag fehlt. Häkchen „Übernehmen“ entfernen, um einen Beleg auszulassen.</p>`,
      null, "", { foot:`<button class="btn accent wide" id="btSave" disabled>Belege werden gelesen …</button>`, cancelLabel:"Abbrechen" });
    btRender();
    const list=$("#btList");
    const upd=e=>{ const el=e.target.closest("[data-bf]"), row=e.target.closest("[data-bi]"); if(!el||!row||!BT) return;
      const r=BT.rows[+row.dataset.bi], f=el.dataset.bf;
      if(f==="on"){ r.on=el.checked; btRender(+row.dataset.bi); return; }
      r.d[f] = f==="brutto" ? r2(parseNum(el.value)||0) : f==="satz" ? +el.value : el.value.trim();
      r.check.delete(f); el.closest("label")?.classList.remove("bchk");
      if(f==="lieferant"){ const b=row.querySelector(".bname b"); if(b) b.textContent=r.d.lieferant||r.name; }
      row.classList.toggle("miss", r.on && (!r.d.lieferant || !(r.d.brutto>0)));
      if(e.type==="change") { const w=row.querySelector(".bwarn"), dup=btDup(r); if(w&&!dup) w.remove(); }
      const sel=BT.rows.filter(x=>x.on && !["wait","read"].includes(x.st)), go=$("#btSave");
      if(go && !BT.running) go.innerHTML=`${ico.checkc} Alle ${sel.length} Ausgabe${sel.length===1?"":"n"} speichern · ${eur(sel.reduce((s,x)=>s+(x.d.brutto||0),0))}`; };
    list.addEventListener("input", upd); list.addEventListener("change", upd);
    list.addEventListener("click", e=>{ const v=e.target.closest("[data-bview]"); if(!v || !BT) return; const i=+v.closest("[data-bi]").dataset.bi, r=BT.rows[i]; if(!r?.beleg) return;
      const ready=!["wait","read"].includes(r.st);
      showBeleg(r.beleg, { title:r.d.lieferant||r.name, fields: ready ? r.d : null, focus: ready && !(r.d.brutto>0) ? "brutto" : null,
        onEdit:(q,v)=>{ r.d[q]=v; r.check.delete(q); },
        onClose:()=>{ if(!BT) return; btRender(i); } }); });
    $("#btSave").onclick=btSave;
    const tok=BT.tok; btProcess(tok);
    // Sheet geschlossen → Verarbeitung stoppen
    const stop=()=>{ if(BT && BT.tok===tok && $("#sheet").hidden){ BT=null; } else if(BT && BT.tok===tok) setTimeout(stop, 800); }; setTimeout(stop, 800);
  }
  async function btSave(){
    if(!BT || BT.running) return;
    const sel=BT.rows.filter(r=>r.on && !["wait","read"].includes(r.st));
    const bad=sel.filter(r=>!r.d.lieferant || !(r.d.brutto>0));
    if(bad.length){ toast(`${bad.length} Beleg${bad.length===1?"":"e"}: Händler oder Betrag fehlt`); const i=BT.rows.indexOf(bad[0]); $(`#btList [data-bi="${i}"]`)?.scrollIntoView({block:"center", behavior:"smooth"}); btRender(); return; }
    const go=$("#btSave"); go.disabled=true; go.innerHTML=`<span class="ocrspin" aria-hidden="true"></span> Speichere …`;
    const now=nowStamp(), out=[];
    sel.forEach((r,k)=>{ const id=uid()+k; const d=r.d;
      const o={ id, datum:d.datum||today(), lieferant:d.lieferant, belegNr:d.nr||"", brutto:r2(d.brutto), satz:+d.satz, kategorie:d.kategorie||"Sonstiges", auftragId:"", notiz:d.notiz||"", created:now };
      if(r.beleg){ o.bild=true; o.bildTyp=r.beleg.typ; o.bildName=r.beleg.name; o.bildLokal = mode==="db" && r.beleg.data.length>DB_IMG_MAX; if(r.ocrText) o.ocrText=r.ocrText; }
      out.push([o, r.beleg]); upsertLocal("ausgaben", o); });
    lsSave(); UI.ausMonth=(out[out.length-1]?.[0].datum||today()).slice(0,7); render();
    let fail=0;
    for(const [o,b] of out){
      if(mode==="db"){ const {id,...body}=o; try{ await dbRefs.ausgaben.doc(id).set(body); }catch(e){ fail++; } }
      if(b) await BILD.put(o.id, b);
    }
    const sum=out.reduce((s,[o])=>s+o.brutto,0);
    BT=null; closeSheet();
    toast(fail ? `${out.length-fail} von ${out.length} gespeichert – ${fail} fehlgeschlagen` : `${out.length} Ausgabe${out.length===1?"":"n"} gespeichert · ${eur(sum)}`);
  }

  /* ---------- Ladebildschirm (Splash) ---------- */
  let splashGone=false, splashReq=false;
  const SPLASH_MIN=4000;                                          // so lange läuft die Intro-Animation (Karte → Icon → Schriftzug → Lichtreflex)
  function splashOut(){
    if(splashGone) return; splashGone=true;
    const sp=document.getElementById("splash"); if(!sp) return;
    sp.classList.add("out"); setTimeout(()=>sp.remove(), 700);
  }
  function hideSplash(){
    if(splashReq) return; splashReq=true;
    const fast=matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(splashOut, Math.max(0, (fast?900:SPLASH_MIN)-performance.now()));
  }
  document.getElementById("splash")?.addEventListener("click", ()=>{ if(splashReq) splashOut(); });   // Tippen überspringt, sobald die App bereit ist
  setTimeout(hideSplash, 7000);                                  // Sicherheitsnetz, falls die Prüfung hängt
  /* ---------- WerkDoc Cloud: Supabase-Anmeldung & Synchronisierung ---------- */
  // Offline-first: Alles wird sofort lokal gespeichert. Änderungen landen in einer Warteschlange („Outbox“)
  // und werden hochgeladen, sobald eine Verbindung besteht. Andere Geräte holen sich die Änderungen ab.
  const SB_URL = "https://zalniuqiberpnzgbbufk.supabase.co";
  const SB_KEY = "sb_publishable_9BQH108_KtPssfLocODpUQ_Cy3r2lko";   // öffentlicher Schlüssel – Schutz über Row Level Security
  const SB_CDN = ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/dist/umd/supabase.js",
                  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"];
  const SB_TABLE = "wb_records";
  const SB_STORE = "sb-zalniuqiberpnzgbbufk-auth-token";
  const IS_PREVIEW = !!(window.claude && window.claude.use);       // Claude-Vorschau (hat eigenen Speicher)
  const BELEG_CLOUD_MAX = 4*1024*1024;                               // größere PDFs bleiben nur auf dem Gerät
  let sb=null, sbLoading=null, sbChan=null, pullTimer=null, pushT=null;
  const CLOUD = { user:null, status:"aus", msg:"", last:"", pushing:false, pulling:false, off:false, skip:false, ready:false };

  async function sbClient(){
    if(sb) return sb;
    if(!sbLoading) sbLoading=(async()=>{
      if(!window.supabase?.createClient) for(const u of SB_CDN){ try{ await withTimeout(loadScript(u), 15000, "Supabase lädt nicht"); }catch(e){} if(window.supabase?.createClient) break; }
      if(!window.supabase?.createClient) throw new Error("sdk");
      sb=window.supabase.createClient(SB_URL, SB_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:SB_STORE } });
      return sb;
    })().catch(e=>{ sbLoading=null; throw e; });
    return sbLoading;
  }
  function storedUser(){ try{ const j=JSON.parse(localStorage.getItem(SB_STORE)||"null"); return j?.user || j?.currentSession?.user || null; }catch(e){ return null; } }
  const lsGet=(k,d)=>{ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } };
  const lsSet=(k,v)=>{ try{ v==null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const obKey = () => "wb-outbox-"+(CLOUD.user?.id||"x");
  const obLoad = () => lsGet(obKey(), {});
  const obSave = o => lsSet(obKey(), o);
  const obCount = () => Object.keys(obLoad()).length;
  const cloudOn = () => !!CLOUD.user && !CLOUD.off;

  function sbErrMsg(e){
    const m=String(e?.message||e?.error_description||e||"");
    if(/Invalid login credentials/i.test(m)) return "E-Mail oder Passwort ist falsch.";
    if(/Email not confirmed/i.test(m)) return "Bitte bestätige zuerst deine E-Mail – den Link findest du in deinem Postfach.";
    if(/already registered|already been registered|User already exists/i.test(m)) return "Für diese E-Mail gibt es schon einen Zugang. Bitte anmelden.";
    if(/Password should be at least|weak password|password.*(short|length)/i.test(m)) return "Das Passwort ist zu kurz oder zu einfach (mindestens 8 Zeichen).";
    if(/rate limit|For security purposes|too many/i.test(m)) return "Zu viele Versuche – bitte kurz warten und erneut versuchen.";
    if(/invalid.*email|Unable to validate email/i.test(m)) return "Bitte eine gültige E-Mail-Adresse eingeben.";
    if(/relation .*wb_records.* does not exist|Could not find the table|PGRST205|42P01/i.test(m)) return "Die Cloud-Tabelle fehlt noch – bitte das Setup-SQL in Supabase ausführen.";
    if(/row-level security|permission denied|42501/i.test(m)) return "Zugriff verweigert – bitte die Sicherheitsregeln (RLS) aus dem Setup-SQL prüfen.";
    if(/Failed to fetch|NetworkError|Load failed|network/i.test(m) || navigator.onLine===false) return "Keine Verbindung zum Server.";
    if(m==="sdk") return "Die Anmeldung konnte nicht geladen werden (keine Verbindung?).";
    return m || "Unbekannter Fehler";
  }
  function setCloud(status, msg=""){
    CLOUD.status=status; CLOUD.msg=msg; if(status==="ok") CLOUD.last=nowStamp();
    const el=$("#cloudState"); if(el){ el.className="cstate "+status; el.innerHTML=cloudStateHtml(); }
  }
  function cloudStateHtml(){
    const n=obCount();
    if(CLOUD.off) return `<i></i>Diese Vorschau speichert im Claude-Konto – die Cloud-Synchronisierung läuft in der installierten App.`;
    if(navigator.onLine===false) return `<i></i>Offline – ${n?`${n} Änderung${n===1?" wird":"en werden"} später hochgeladen`:"alles lokal gespeichert"}`;
    return ({ sync:`<i></i>Synchronisiere …`, err:`<i></i>${esc(CLOUD.msg||"Fehler")}${n?` · ${n} ausstehend`:""}`,
      ok:`<i></i>Synchronisiert${CLOUD.last?` · ${deStamp(CLOUD.last)}`:""}${n?` · ${n} ausstehend`:""}` })[CLOUD.status] || `<i></i>${n?`${n} Änderung${n===1?"":"en"} ausstehend`:"Bereit"}`;
  }

  /* --- Änderungen vormerken & hochladen --- */
  function cloudQueue(coll, id, data, deleted=false){
    if(!cloudOn() || !id) return;
    if(coll==="firma" && !CLOUD.ready) return;            // Schutz: vor dem ersten Laden nichts über die Cloud-Firmendaten schreiben
    const o=obLoad(), upd=Date.now();
    let d = deleted ? null : (data ? JSON.parse(JSON.stringify(data)) : null);
    if(d && coll==="beleg" && (d.data||"").length>BELEG_CLOUD_MAX) return;   // zu groß → nur lokal
    o[coll+"/"+id]={coll, id, data:d, deleted, upd}; obSave(o);
    schedulePush();
  }
  function schedulePush(ms=1500){ clearTimeout(pushT); pushT=setTimeout(cloudPush, ms); }
  async function cloudPush(){
    if(!cloudOn() || CLOUD.pushing) return;
    if(navigator.onLine===false){ setCloud("offline"); return; }
    const items=Object.values(obLoad()); if(!items.length){ setCloud("ok"); return; }
    CLOUD.pushing=true; setCloud("sync");
    try{
      const c=await sbClient(); const uid=CLOUD.user.id;
      const small=items.filter(x=>x.coll!=="beleg"), big=items.filter(x=>x.coll==="beleg");
      const groups=[]; for(let i=0;i<small.length;i+=200) groups.push(small.slice(i,i+200)); big.forEach(x=>groups.push([x]));
      for(const g of groups){
        const { error }=await c.from(SB_TABLE).upsert(g.map(x=>({ user_id:uid, coll:x.coll, id:x.id, data:x.data, deleted:x.deleted, upd:x.upd })), { onConflict:"user_id,coll,id" });
        if(error) throw error;
        const cur=obLoad(); for(const x of g){ const k=x.coll+"/"+x.id; if(cur[k] && cur[k].upd===x.upd) delete cur[k]; } obSave(cur);
      }
      setCloud("ok");
    }catch(e){ setCloud("err", sbErrMsg(e)); setTimeout(()=>schedulePush(0), 30000); }
    finally{ CLOUD.pushing=false; }
    if(obCount() && CLOUD.status==="ok") schedulePush(300);
  }

  /* --- Änderungen anderer Geräte holen --- */
  function applyRemote(r){
    const pend=obLoad()[r.coll+"/"+r.id]; if(pend && pend.upd>=r.upd) return false;   // eigene neuere Änderung wartet noch
    if(r.coll==="firma"){
      if(r.deleted || !r.data || (S.firma._upd||0)>r.upd) return false;
      S.firma={...r.data, _upd:r.upd}; return true;
    }
    if(r.coll==="beleg"){ if(r.deleted){ BILD.cache.delete(r.id); BILD.tx("readwrite", s=>s.delete(r.id)); } return false; }
    if(!COLLS.includes(r.coll)) return false;
    const arr=S[r.coll], i=arr.findIndex(x=>x.id===r.id), loc=i>=0?arr[i]:null;
    if(loc && (loc._upd||0)>r.upd) return false;
    if(r.deleted){ if(i>=0){ arr.splice(i,1); return true; } return false; }
    const obj={...r.data, id:r.id, _upd:r.upd};
    if(i>=0) arr[i]=obj; else arr.push(obj); return true;
  }
  async function cloudPull(full=false){
    if(!cloudOn() || CLOUD.pulling || navigator.onLine===false) return;
    CLOUD.pulling=true;
    const lk="wb-lastpull-"+CLOUD.user.id; let since = full ? null : lsGet(lk, null), changed=0;
    try{
      const c=await sbClient();
      for(let page=0; page<50; page++){
        let q=c.from(SB_TABLE).select("coll,id,data,deleted,upd,updated_at").neq("coll","beleg").order("updated_at",{ascending:true}).limit(500);
        if(since) q=q.gt("updated_at", since);
        const { data, error }=await q; if(error) throw error;
        for(const r of data) if(applyRemote(r)) changed++;
        if(data.length) since=data[data.length-1].updated_at;
        if(data.length<500) break;
      }
      if(since) lsSet(lk, since);
      if(changed){ lsSave(); render(); }
      if(CLOUD.status!=="err") setCloud(obCount()?"sync":"ok");
    }catch(e){ setCloud("err", sbErrMsg(e)); }
    finally{ CLOUD.pulling=false; }
    return changed;
  }
  async function cloudBeleg(id){
    if(!cloudOn() || navigator.onLine===false) return null;
    try{ const c=await sbClient(); const { data }=await c.from(SB_TABLE).select("data,deleted").eq("coll","beleg").eq("id",id).maybeSingle();
      return data && !data.deleted ? data.data : null; }catch(e){ return null; }
  }
  async function cloudSyncNow(){ await cloudPush(); await cloudPull(); if(!obCount() && CLOUD.status!=="err") setCloud("ok"); }
  function cloudRealtime(){
    try{ if(sbChan) sb.removeChannel(sbChan);
      sbChan=sb.channel("wb-"+CLOUD.user.id).on("postgres_changes", { event:"*", schema:"public", table:SB_TABLE, filter:`user_id=eq.${CLOUD.user.id}` },
        p=>{ const r=p.new && p.new.coll ? p.new : null; if(r && r.coll!=="beleg" && applyRemote(r)){ lsSave(); render(); } }).subscribe();
    }catch(e){}
  }

  /* --- Gemini-Key: Kopie je Konto auf dem Gerät, falls die Cloud-Firmendaten ihn (noch) nicht haben --- */
  function gemKeyRemember(){ if(CLOUD.user && S.firma.geminiApiKey) lsSet("wb-gemkey-"+CLOUD.user.id, S.firma.geminiApiKey); }
  function gemKeyRestore(uid){
    const k=lsGet("wb-gemkey-"+uid, ""); if(S.firma.geminiApiKey){ lsSet("wb-gemkey-"+uid, S.firma.geminiApiKey); return; }
    if(k){ S.firma.geminiApiKey=k; setTimeout(()=>{ if(CLOUD.ready && S.firma.geminiApiKey===k) saveFirma({...S.firma}); }, 0); }
  }
  /* --- Gerät einem Konto zuordnen (verhindert, dass Daten verschiedener Konten vermischt werden) --- */
  function localHasData(){ return COLLS.some(c=>S[c].length) || Object.keys(S.firma||{}).some(k=>!["created","_upd"].includes(k)); }
  async function wipeLocal(){
    for(const c of COLLS) S[c]=[]; S.firma={};
    try{ localStorage.removeItem(LS_KEY); localStorage.removeItem("rm-recent"); }catch(e){}
    BILD.cache.clear(); await BILD.tx("readwrite", s=>s.clear());
    render();
  }
  function cloudQueueAll(){
    const o=obLoad(), upd=Date.now();
    for(const c of COLLS) for(const x of S[c]) o[c+"/"+x.id]={coll:c, id:x.id, data:JSON.parse(JSON.stringify(x)), deleted:false, upd:x._upd||upd};
    if(Object.keys(S.firma||{}).length) o["firma/main"]={coll:"firma", id:"main", data:JSON.parse(JSON.stringify(S.firma)), deleted:false, upd:S.firma._upd||upd};
    obSave(o);
    // Belegbilder nachreichen
    (async()=>{ for(const x of S.ausgaben) if(x.bild){ const b=await BILD.get(x.id); if(b) cloudQueue("beleg", x.id, {typ:b.typ, data:b.data, name:b.name, size:b.size}); } })();
  }
  async function onAuthed(user, {offline=false}={}){
    const fresh = CLOUD.user?.id!==user.id;
    CLOUD.user=user; CLOUD.off = IS_PREVIEW && mode==="db";
    hideAuth(); hideSplash();
    if(!fresh){ if(!offline) cloudSyncNow(); return; }
    CLOUD.ready=false;
    const owner=lsGet("wb-owner", null);
    if(owner && owner!==user.id){ await wipeLocal(); lsSet("wb-lastpull-"+user.id, null); }
    const adopt = !owner && localHasData();             // vorhandene Daten auf diesem Gerät dem Konto übergeben
    lsSet("wb-owner", user.id);
    const fillGaps=()=>{                                  // nur leere Felder aus dem Registrierungsprofil ergänzen (lokal, ohne Upload)
      const md=user.user_metadata||{};
      if(!S.firma.name && md.firma) S.firma.name=md.firma;
      if(!S.firma.ansprechpartner && md.name) S.firma.ansprechpartner=md.name;
      if(!S.firma.mail && user.email) S.firma.mail=user.email;
      gemKeyRestore(user.id);
      CLOUD.ready=true; lsSave(); render();
    };
    if(CLOUD.off){ fillGaps(); setCloud("aus"); return; }
    if(adopt) cloudQueueAll();
    if(offline){ fillGaps(); setCloud("offline"); return; }
    try{ await sbClient(); }catch(e){ fillGaps(); setCloud("err", sbErrMsg(e)); return; }
    await cloudPull(!!adopt || !lsGet("wb-lastpull-"+user.id, null));
    fillGaps();
    await cloudPush();
    if(adopt) toast("Deine Daten werden jetzt in die Cloud übertragen");
    cloudRealtime();
    clearInterval(pullTimer); pullTimer=setInterval(()=>{ if(document.visibilityState==="visible") cloudSyncNow(); }, 120000);
  }
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible" && cloudOn()) cloudSyncNow(); });
  window.addEventListener("online", ()=>{ if(cloudOn()) cloudSyncNow(); else setCloud(CLOUD.status); });
  window.addEventListener("offline", ()=>setCloud("offline"));

  /* --- Anmeldebildschirm --- */
  let AUTH_VIEW="login", LOGGING_OUT=false;
  function showAuth(view="login", opt={}){
    AUTH_VIEW=view; hideSplash(); let el=$("#auth");
    if(!el){ document.body.insertAdjacentHTML("beforeend", `<div id="auth" class="auth" role="dialog" aria-modal="true" aria-labelledby="authTitle"></div>`); el=$("#auth"); }
    el.hidden=false; document.documentElement.classList.add("auth-open");
    const logo="";
    const brand=`<div class="au-brand"><h1>WerkDoc<span>by RM</span></h1><p>Einfach. Smart. Digital.</p></div>`;
    const pw=(id,ph,lbl="Passwort",auto="current-password")=>`<div class="au-f"><div class="au-l"><label for="${id}">${lbl}</label><button type="button" class="au-show" data-pw="${id}">Anzeigen</button></div><input id="${id}" type="password" autocomplete="${auto}" placeholder="${ph}"></div>`;
    const fld=(id,lbl,type="text",ph="",auto="")=>`<div class="au-f"><label for="${id}">${lbl}</label><input id="${id}" type="${type}" placeholder="${ph}" ${auto?`autocomplete="${auto}"`:""} ${type==="email"?'inputmode="email" autocapitalize="off" spellcheck="false"':""}></div>`;
    const V={
      login:`${logo}<form class="au-card" id="auForm" novalidate><h2 id="authTitle">Willkommen zurück</h2><p class="au-sub">Melde dich mit deinem WerkDoc-Zugang an.</p>
        ${fld("auMail","E-Mail","email","name@firma.de","username")}${pw("auPw","Passwort")}
        <div class="au-msg" id="auMsg" hidden></div>
        <button class="au-btn" type="submit" id="auGo">Sicher anmelden</button>
        <button class="au-btn2" type="button" data-av="register">Neue Firma registrieren</button>
        <button class="au-link" type="button" data-av="reset">Passwort vergessen?</button>
        <p class="au-foot">Deine Daten liegen geschützt in deinem Konto und bleiben auch offline auf diesem Gerät nutzbar.</p>
        ${IS_PREVIEW?`<button class="au-link muted" type="button" id="auSkip">Ohne Anmeldung testen (nur diese Vorschau)</button>`:""}</form>`,
      register:`${logo}<form class="au-card" id="auForm" novalidate><h2 id="authTitle">Neue Firma registrieren</h2><p class="au-sub">Lege deinen WerkDoc-Zugang an. Danach bekommst du eine E-Mail zur Bestätigung.</p>
        ${fld("auFirma","Firmenname","text","z. B. RepairMobile","organization")}${fld("auName","Vor- und Nachname","text","","name")}${fld("auMail","E-Mail","email","name@firma.de","email")}${pw("auPw","mindestens 8 Zeichen","Passwort","new-password")}
        <div class="au-msg" id="auMsg" hidden></div>
        <button class="au-btn" type="submit" id="auGo">Registrierung absenden</button>
        <button class="au-link" type="button" data-av="login">Ich habe schon einen Zugang – anmelden</button></form>`,
      reset:`${logo}<form class="au-card" id="auForm" novalidate><h2 id="authTitle">Passwort zurücksetzen</h2><p class="au-sub">Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.</p>
        ${fld("auMail","E-Mail","email","name@firma.de","username")}<div class="au-msg" id="auMsg" hidden></div>
        <button class="au-btn" type="submit" id="auGo">Link senden</button><button class="au-link" type="button" data-av="login">Zurück zur Anmeldung</button></form>`,
      newpw:`${logo}<form class="au-card" id="auForm" novalidate><h2 id="authTitle">Neues Passwort</h2><p class="au-sub">Lege jetzt dein neues Passwort fest.</p>
        ${pw("auPw","mindestens 8 Zeichen","Neues Passwort","new-password")}<div class="au-msg" id="auMsg" hidden></div>
        <button class="au-btn" type="submit" id="auGo">Passwort speichern</button></form>`,
      mail:`${logo}<div class="au-card"><div class="au-ok">✉︎</div><h2 id="authTitle">Fast geschafft!</h2><p class="au-sub">${opt.text||""}</p>
        <button class="au-btn" type="button" data-av="login">Zur Anmeldung</button></div>`
    };
    const slot=$("#auSlot", el), soft=!!slot && !reducedMotion() && !!slot.animate;
    const fill=()=>{
      if(!$("#auSlot", el)) el.innerHTML=`<div class="au-wrap">${brand}<div class="au-slot" id="auSlot"></div></div>`;
      $("#auSlot", el).innerHTML=V[view];
      if(opt.msg) authMsg(opt.msg, opt.kind||"err");
      if(opt.mail && $("#auMail")) $("#auMail").value=opt.mail;
      const f=$("#auForm"); if(f) f.onsubmit=e=>{ e.preventDefault(); authSubmit(); };
    };
    // Sanftes Überblenden (wie „Bewegung reduzieren“ auf dem iPhone): alte Karte blendet aus, neue ein – ohne Wegschieben
    if(soft){
      const card=slot.firstElementChild, h0=slot.offsetHeight;
      const out=card ? card.animate([{opacity:1},{opacity:0}], {duration:150, easing:"ease-out", fill:"forwards"}) : null;
      const swap=()=>{ fill(); const nc=$("#auSlot", el).firstElementChild, h1=$("#auSlot", el).offsetHeight;
        if(el.scrollTop>0) el.scrollTo({top:0, behavior:"smooth"});
        $("#auSlot", el).animate([{height:h0+"px"},{height:h1+"px"}], {duration:280, easing:"cubic-bezier(.25,.8,.25,1)"});
        nc?.animate([{opacity:0},{opacity:1}], {duration:260, delay:40, easing:"ease-out", fill:"backwards"}); };
      if(out) out.onfinish=swap; else swap();
    } else fill();
    el.onclick=e=>{ const v=e.target.closest("[data-av]"); if(v){ const m=$("#auMail")?.value; showAuth(v.dataset.av, {mail:m}); return; }
      const s=e.target.closest("[data-pw]"); if(s){ const i=$("#"+s.dataset.pw); i.type=i.type==="password"?"text":"password"; s.textContent=i.type==="password"?"Anzeigen":"Verbergen"; }
      if(e.target.id==="auSkip"){ CLOUD.skip=true; hideAuth(); toast("Vorschau ohne Anmeldung"); } };
    setTimeout(()=>{ const first=$("#auForm input"); if(first && !first.value && matchMedia("(pointer:fine)").matches) first.focus(); }, 200);
  }
  function hideAuth(){ const el=$("#auth"); if(el){ el.hidden=true; el.innerHTML=""; } document.documentElement.classList.remove("auth-open"); }
  function authMsg(t, kind="err"){ const m=$("#auMsg"); if(!m) return; m.hidden=!t; m.className="au-msg "+kind; m.textContent=t||""; }
  async function authSubmit(){
    const go=$("#auGo"), label=go.textContent; const busy=b=>{ go.disabled=b; go.innerHTML=b?`<span class="ocrspin"></span>`:label; };
    const mail=val("auMail").toLowerCase(), pw=$("#auPw")?.value||"";
    authMsg("");
    if(AUTH_VIEW!=="newpw" && !/^\S+@\S+\.\S+$/.test(mail)) return authMsg("Bitte eine gültige E-Mail-Adresse eingeben.");
    if(AUTH_VIEW!=="reset" && !pw) return authMsg("Bitte das Passwort eingeben.");
    if((AUTH_VIEW==="register"||AUTH_VIEW==="newpw") && pw.length<8) return authMsg("Das Passwort braucht mindestens 8 Zeichen.");
    if(AUTH_VIEW==="register" && !val("auFirma")) return authMsg("Bitte den Firmennamen eintragen.");
    busy(true);
    try{
      const c=await sbClient(); const redirect=location.origin+location.pathname;
      if(AUTH_VIEW==="login"){
        const { data, error }=await c.auth.signInWithPassword({ email:mail, password:pw }); if(error) throw error;
        await onAuthed(data.user); toast("Angemeldet");
      } else if(AUTH_VIEW==="register"){
        const { data, error }=await c.auth.signUp({ email:mail, password:pw, options:{ emailRedirectTo:redirect, data:{ firma:val("auFirma"), name:val("auName") } } });
        if(error) throw error;
        if(data.user && Array.isArray(data.user.identities) && !data.user.identities.length) throw new Error("User already registered");
        if(data.session){ await onAuthed(data.user); toast("Willkommen bei WerkDoc!"); }
        else showAuth("mail", { text:`Wir haben dir eine E-Mail an <b>${esc(mail)}</b> geschickt. Tippe auf den Link darin, um deinen Zugang zu bestätigen – danach kannst du dich hier anmelden.` });
      } else if(AUTH_VIEW==="reset"){
        const { error }=await c.auth.resetPasswordForEmail(mail, { redirectTo:redirect }); if(error) throw error;
        showAuth("mail", { text:`Falls es zu <b>${esc(mail)}</b> einen Zugang gibt, ist ein Link zum Zurücksetzen unterwegs.` });
      } else if(AUTH_VIEW==="newpw"){
        const { data, error }=await c.auth.updateUser({ password:pw }); if(error) throw error;
        await onAuthed(data.user); toast("Neues Passwort gespeichert");
      }
    }catch(e){ authMsg(sbErrMsg(e)); }
    finally{ if($("#auGo")) busy(false); }
  }
  async function authBoot(){
    const su=storedUser();
    // Offline mit gespeicherter Sitzung: sofort weiterarbeiten
    if(su && navigator.onLine===false){ onAuthed(su, {offline:true}); }
    try{
      const c=await sbClient();
      c.auth.onAuthStateChange((ev, session)=>{
        if(ev==="PASSWORD_RECOVERY"){ showAuth("newpw"); return; }
        if(ev==="SIGNED_OUT"){ if(!LOGGING_OUT && !CLOUD.skip){ CLOUD.user=null; showAuth("login"); } return; }
        if(session?.user && ev==="SIGNED_IN" && AUTH_VIEW!=="newpw") setTimeout(()=>onAuthed(session.user), 0);
      });
      const { data }=await c.auth.getSession();
      if(/[#&](access_token|type=)/.test(location.hash)) history.replaceState(null, "", location.pathname+location.search);
      if(data.session?.user){ if(AUTH_VIEW!=="newpw") onAuthed(data.session.user); }
      else if(!CLOUD.user || !su) showAuth("login");
    }catch(e){
      if(su) onAuthed(su, {offline:true});
      else showAuth("login", { msg:sbErrMsg(e) });
    }
  }
  let LOGOUT_ASK=null;
  async function logoutNow(){
      LOGOUT_ASK=null; LOGGING_OUT=true; closeSheet();
      clearInterval(pullTimer); try{ if(sbChan) sb.removeChannel(sbChan); }catch(e){}
      try{ const c=await sbClient(); await c.auth.signOut({ scope:"local" }); }catch(e){}
      try{ localStorage.removeItem(SB_STORE); }catch(e){}
      lsSet(obKey(), null); lsSet("wb-owner", null); if(CLOUD.user) lsSet("wb-lastpull-"+CLOUD.user.id, null);
      CLOUD.user=null; CLOUD.ready=false; await wipeLocal(); LOGGING_OUT=false; UI.view="auftraege";
      showAuth("login", { msg:"Du wurdest abgemeldet.", kind:"ok" });
  }
  async function logout(){
    if(obCount()) await cloudPush();
    const n=obCount();
    LOGOUT_ASK = n ? `${n} Änderung${n===1?" ist":"en sind"} noch nicht in der Cloud (keine Verbindung?). Beim Abmelden gehen sie verloren. Trotzdem abmelden?`
                   : "Abmelden? Deine Daten bleiben sicher in der Cloud und werden beim nächsten Anmelden wieder geladen.";
    render(); requestAnimationFrame(()=>$("#grpKonto")?.scrollIntoView({block:"center", behavior:"smooth"}));
  }
  function accountGroup(){
    if(!CLOUD.user) return CLOUD.skip ? `<div class="group" id="grpKonto"><span class="glabel">Konto &amp; Cloud</span><div class="card"><span style="color:var(--muted)">Vorschau ohne Anmeldung.</span><div class="btnrow"><button class="btn" data-act="login">Anmelden</button></div></div></div>` : "";
    const u=CLOUD.user;
    return `<div class="group" id="grpKonto"><span class="glabel">Konto &amp; Cloud</span><div class="card acct">
      <div class="row"><span class="acav">${esc((u.user_metadata?.name||u.email||"?").trim()[0]||"?").toUpperCase()}</span><span class="acwho"><b>${esc(u.user_metadata?.name||S.firma.ansprechpartner||"Angemeldet")}</b><small>${esc(u.email||"")}</small></span></div>
      <div class="cstate ${CLOUD.status}" id="cloudState">${cloudStateHtml()}</div>
      ${LOGOUT_ASK?`<div class="confirm"><span>${LOGOUT_ASK}</span><div class="btnrow"><button class="btn danger" data-act="logoutYes">Ja, abmelden</button><button class="btn ghost" data-act="logoutNo">Abbrechen</button></div></div>`
        :`<div class="btnrow">${CLOUD.off?"":`<button class="btn ghost" data-act="syncNow">${ico.sync} Jetzt synchronisieren</button>`}<button class="btn danger" data-act="logout">Abmelden</button></div>`}
    </div></div>`;
  }

  /* ---------- Kontakte & Produkte: Import / Export ---------- */
  const LANDS={de:"Deutschland",at:"Österreich",ch:"Schweiz",pt:"Portugal",it:"Italien",fr:"Frankreich",nl:"Niederlande",pl:"Polen",es:"Spanien",tr:"Türkei"};
  function landCode(l){ const v=String(l||"").trim(); if(/^[a-z]{2}$/i.test(v)) return v.toUpperCase(); const hit=Object.entries(LANDS).find(([c,n])=>n.toLowerCase()===v.toLowerCase()); return hit?hit[0].toUpperCase():v; }
  function ioBar(kind, n, one, many){
    const K = kind==="kunden" ? "Kunden" : "Teile";
    return `<div class="iobar"><span class="cnt">${n} ${n===1?one:many}</span>
      <button class="btn ghost sm" data-act="import${K}">${ico.upl} Importieren</button>
      <button class="btn ghost sm" data-act="export${K}" ${n?"":"disabled style='opacity:.5'"}>${ico.dl} Exportieren ▾</button>
      ${n ? (UI.sel?.kind===kind ? `<button class="btn sm" data-act="selDone">Fertig</button>` : `<button class="btn ghost sm" data-act="selStart" data-kind="${kind}">${ico.checkc} Auswählen</button>`) : ""}</div>`;
  }
  function exportMenu(kind){
    const label = kind==="kunden" ? "Kontakte" : "Produkte";
    openPicker(`${label} exportieren`, [
      {label:"PDF-Liste", sub:"Übersicht zum Ausdrucken oder Weiterleiten", v:"pdf"},
      {label:"CSV (Excel)", sub:"Tabelle für Excel, Numbers oder zum Import in andere Programme", v:"csv"}
    ], o => o.v==="pdf" ? exportListPdf(kind) : exportListCsv(kind));
  }

  /* --- CSV lesen --- */
  async function readTextFile(file){
    const buf = await file.arrayBuffer();
    try{ return new TextDecoder("utf-8",{fatal:true}).decode(buf); }catch(e){ return new TextDecoder("windows-1252").decode(buf); }
  }
  function parseCSV(text){
    text = text.replace(/^﻿/, "");
    const first = (text.split(/\r?\n/).find(l=>l.trim())||"");
    let d=";", best=-1; for(const c of [";",",","\t"]){ const n=first.split(c).length; if(n>best){ best=n; d=c; } }
    const rows=[]; let row=[], cell="", q=false;
    for(let i=0;i<text.length;i++){ const ch=text[i];
      if(q){ if(ch==='"'){ if(text[i+1]==='"'){ cell+='"'; i++; } else q=false; } else cell+=ch; }
      else if(ch==='"' && cell==="") q=true;
      else if(ch===d){ row.push(cell); cell=""; }
      else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&text[i+1]==="\n") i++; row.push(cell); rows.push(row); row=[]; cell=""; }
      else cell+=ch; }
    if(cell!=="" || row.length){ row.push(cell); rows.push(row); }
    return rows.map(r=>r.map(c=>c.trim())).filter(r=>r.some(Boolean));
  }
  const normH = s => String(s||"").toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]/g,"");
  const IMPORT_FIELDS = {
    kunden: [
      ["nr","Kunden-Nr.",["kundennr","kundennummer","kndnr","kdnr","knr","kontaktnr","kontaktnummer","debitorennr","customernumber","nr","nummer"]],
      ["vorname","Vorname",["vorname","firstname","givenname"]],
      ["nachname","Nachname",["nachname","familienname","surname","lastname","familyname"]],
      ["firma","Firma",["firma","organisation","organization","unternehmen","company","firmenname","organisationsname"]],
      ["name","Name",["name","kunde","kontakt","anzeigename","vollername","kundenname","kontaktname","bezeichnung"]],
      ["strasse","Straße",["strasse","strassehausnummer","strassenr","strasseundhausnummer","adresse","anschrift","street","adresszeile1","rechnungsadressestrasse"]],
      ["plz","PLZ",["plz","postleitzahl","zip","zipcode","postalcode","rechnungsadresseplz"]],
      ["ort","Ort",["ort","stadt","city","wohnort","rechnungsadresseort"]],
      ["land","Land",["land","country","staat","rechnungsadresseland"]],
      ["tel","Telefon",["telefon","tel","telefonnummer","mobil","handy","mobilnummer","phone","telefonprivat","telefongeschaeftlich","mobiltelefon"]],
      ["mail","E-Mail",["email","mail","emailadresse","emailprivat","emailgeschaeftlich"]]
    ],
    teile: [
      ["artnr","Artikelnr.",["artikelnummer","artikelnr","artnr","produktnummer","produktnr","sku","partnumber","nr","nummer"]],
      ["bez","Bezeichnung",["name","bezeichnung","produkt","produktname","artikel","artikelname","titel","artikelbezeichnung","beschreibung"]],
      ["kategorie","Kategorie",["kategorie","typ","art","category","produktart"]],
      ["einheit","Einheit",["einheit","unit","mengeneinheit"]],
      ["preis","Verkaufspreis",["verkaufspreis","preis","vkpreis","vk","einzelpreis","preisbrutto","bruttopreis","preisnetto","nettopreis","verkaufspreisbrutto","verkaufspreisnetto","price"]],
      ["ek","Einkaufspreis",["einkaufspreis","ekpreis","ek","einkauf","einkaufspreisnetto"]],
      ["bestand","Bestand",["bestand","lagerbestand","menge","anzahl","stock"]],
      ["lager","Lagerort",["lagerort","lager","lagerplatz"]]
    ]
  };
  function mapHeader(kind, header){
    const H=header.map(normH), used=new Set(), map={};
    for(const [key,,syn] of IMPORT_FIELDS[kind]){ const i=H.findIndex((h,ix)=>!used.has(ix) && syn.includes(h)); if(i>=0){ map[key]=i; used.add(i); } }
    for(const [key,,syn] of IMPORT_FIELDS[kind]){ if(map[key]!=null) continue; const i=H.findIndex((h,ix)=>!used.has(ix) && syn.some(s=>s.length>=5 && h.includes(s))); if(i>=0){ map[key]=i; used.add(i); } }
    return map;
  }
  const UNIT_SYN = {stk:"Stk.",stueck:"Stk.",st:"Stk.",std:"Std.",stunde:"Std.",stunden:"Std.",h:"Std.",min:"Min.",minute:"Min.",minuten:"Min.",psch:"psch.",pauschal:"psch.",pauschale:"psch.",tag:"Tag",tage:"Tag",km:"km",m:"m",meter:"m"};
  function toRecords(kind, rows, map){
    const get=(r,k)=> map[k]!=null ? (r[map[k]]||"").trim() : "";
    return rows.map(r=>{
      if(kind==="kunden"){
        let name=get(r,"name"), vor=get(r,"vorname"), nach=get(r,"nachname"), firma=get(r,"firma");
        const person=[vor,nach].filter(Boolean).join(" ");
        if(!name) name = person || firma; else if(person && !name.includes(nach||vor)) name = person;
        let plz=get(r,"plz"), ort=get(r,"ort"), land=get(r,"land");
        const m1=ort.match(/^([A-Z]{2})-(\d{4,5})\s+(.+)$/), m2=ort.match(/^(\d{4,5})\s+(.+)$/);
        if(m1 && !plz){ land=land||LANDS[m1[1].toLowerCase()]||m1[1]; plz=m1[2]; ort=m1[3]; }
        else if(m2 && !plz){ plz=m2[1]; ort=m2[2]; }
        if(/^[A-Z]{2}$/.test(land) && LANDS[land.toLowerCase()]) land=LANDS[land.toLowerCase()];
        return { nr:get(r,"nr"), name, firma: firma && firma!==name ? firma : "", strasse:get(r,"strasse"), plz, ort, land, tel:get(r,"tel"), mail:get(r,"mail") };
      }
      const unitRaw=get(r,"einheit"), unit=UNIT_SYN[normH(unitRaw)] || unitRaw || "Stk.";
      const kat=/dienst|leistung|service/i.test(get(r,"kategorie")) ? "Dienstleistung" : "Artikel";
      const price=v=>parseNum(String(v).replace(/[^\d,.\-]/g,""));
      return { artnr:get(r,"artnr"), bez:get(r,"bez"), kategorie:kat, einheit:unit, preis:price(get(r,"preis")), ek:get(r,"ek")?price(get(r,"ek")):"", bestand:get(r,"bestand")?parseNum(get(r,"bestand")):"", lager:get(r,"lager") };
    }).filter(x=> kind==="kunden" ? x.name : x.bez);
  }
  function findExisting(kind, rec){
    if(kind==="kunden"){
      if(rec.nr){ const hit=S.kunden.find(k=>String(kundenNr(k))===String(rec.nr)); if(hit) return hit; }
      return S.kunden.find(k=>normH(k.name)===normH(rec.name) && (!rec.plz || !k.plz || k.plz===rec.plz));
    }
    if(rec.artnr){ const hit=S.teile.find(t=>t.artnr && normH(t.artnr)===normH(rec.artnr)); if(hit) return hit; }
    return S.teile.find(t=>normH(t.bez)===normH(rec.bez));
  }

  let csvInput=null;
  function pickCsv(kind){
    if(!csvInput){ csvInput=document.createElement("input"); csvInput.type="file"; csvInput.accept=".csv,.txt,text/csv,text/plain"; csvInput.hidden=true; document.body.appendChild(csvInput); }
    csvInput.value=""; csvInput.onchange=async()=>{ const f=csvInput.files&&csvInput.files[0]; if(!f) return;
      if(/\.xlsx?$/i.test(f.name)){ toast("Bitte als CSV speichern (in Excel: Datei › Speichern unter › CSV)"); return; }
      try{ const rows=parseCSV(await readTextFile(f)); kind==="rechnungen" ? previewDocImport(f.name, rows) : previewImport(kind, f.name, rows); }catch(e){ toast("Datei konnte nicht gelesen werden"); } };
    csvInput.click();
  }
  function previewImport(kind, fname, rows){
    const label = kind==="kunden" ? ["Kontakt","Kontakte"] : ["Produkt","Produkte"];
    if(rows.length<2){ toast("Die Datei enthält keine Datenzeilen"); return; }
    let hi=0, map={}; for(let i=0;i<Math.min(5,rows.length-1);i++){ const m=mapHeader(kind, rows[i]); if(Object.keys(m).length>Object.keys(map).length){ map=m; hi=i; } }
    const need = kind==="kunden" ? (map.name!=null||map.firma!=null||map.nachname!=null) : (map.bez!=null);
    if(!need){ toast(kind==="kunden"?"Keine Namens-Spalte gefunden (z. B. „Name“)":"Keine Spalte „Name“ oder „Bezeichnung“ gefunden"); return; }
    const recs=toRecords(kind, rows.slice(hi+1), map);
    const skipped=rows.length-hi-1-recs.length;
    let update=true;
    const counts=()=>{ let neu=0, upd=0; recs.forEach(r=> findExisting(kind,r) ? upd++ : neu++); return {neu, upd}; };
    const chips=IMPORT_FIELDS[kind].filter(([k])=>!(kind==="kunden"&&((["vorname","nachname"].includes(k)&&map[k]==null)||(k==="name"&&map.name==null&&(map.vorname!=null||map.nachname!=null||map.firma!=null))))).map(([k,l])=> map[k]!=null
      ? `<span class="mapchip"><b>${esc(l)}</b><span>← ${esc(rows[hi][map[k]])}</span></span>` : `<span class="mapchip miss"><b>${esc(l)}</b><span>nicht gefunden</span></span>`).join("");
    const prev=recs.slice(0,8).map(r=> kind==="kunden"
      ? `<div class="ir"><span class="mono jobnr">${esc(r.nr||"neu")}</span><b>${esc(r.name)}</b><span class="pill ${findExisting(kind,r)?"s-versendet":"s-bezahlt"}">${findExisting(kind,r)?"vorhanden":"neu"}</span><small>${esc([r.firma, r.strasse, [r.plz,r.ort].filter(Boolean).join(" "), r.tel, r.mail].filter(Boolean).join(" · ")||"–")}</small></div>`
      : `<div class="ir"><span class="mono jobnr">${esc(r.artnr||"–")}</span><b>${esc(r.bez)}</b><span class="num">${eur(r.preis)}</span><small>${esc([r.kategorie, r.einheit, r.bestand!==""?`Bestand ${numIn(r.bestand)}`:""].filter(Boolean).join(" · "))}</small></div>`).join("");
    const c=counts();
    openSheet(`${label[1]} importieren`, `
      <div class="card"><h4>${ico.table}${esc(fname)}</h4><span style="color:var(--muted)">${recs.length} ${recs.length===1?label[0]:label[1]} erkannt${skipped>0?`, ${skipped} leere Zeile${skipped===1?"":"n"} übersprungen`:""}.</span></div>
      <div class="group"><span class="glabel">Erkannte Spalten</span><div class="mapgrid">${chips}</div></div>
      <div class="group"><span class="glabel">Vorschau${recs.length>8?` (erste 8 von ${recs.length})`:""}</span><div class="box imprev">${prev}</div></div>
      ${c.upd?`<div class="card"><div class="lineform"><span><b style="font-weight:600">Vorhandene aktualisieren</b><br><small style="color:var(--muted)">${c.upd} ${c.upd===1?label[0]:label[1]} gibt es schon (gleiche Nummer oder gleicher Name). An: leere Felder werden ergänzt und geänderte Angaben übernommen. Aus: diese werden übersprungen.</small></span><input type="checkbox" class="toggle" id="imUpd" checked></div></div>`:""}
    `, null, "", { foot:`<button class="btn accent wide" id="imGo">${ico.upl} ${recs.length} ${recs.length===1?label[0]:label[1]} importieren</button>` });
    const u=$("#imUpd"); if(u) u.onchange=()=>{ update=u.checked; $("#imGo").innerHTML=`${ico.upl} ${update?recs.length:c.neu} ${label[1]} importieren`; };
    $("#imGo").onclick=()=>{ const res=applyImport(kind, recs, update); closeSheet();
      toast(`${res.neu} neu${res.upd?`, ${res.upd} aktualisiert`:""}${res.skip?`, ${res.skip} übersprungen`:""}`); };
  }
  function applyImport(kind, recs, update){
    let neu=0, upd=0, skip=0; const changed=[];
    for(const r of recs){
      const ex=findExisting(kind, r);
      const clean=Object.fromEntries(Object.entries(r).filter(([,v])=>v!=="" && v!=null));
      let obj;
      if(ex){ if(!update){ skip++; continue; } obj={...ex, ...clean}; upd++; }
      else if(kind==="kunden"){ obj={id:uid(), created:today(), ...clean}; if(!obj.nr) obj.nr=nextKundenNr(); neu++; }
      else { obj={id:uid(), kategorie:"Artikel", einheit:"Stk.", bestand:0, ...clean}; neu++; }
      upsertLocal(kind, obj); changed.push(obj);
    }
    lsSave(); render();
    if(mode==="db") (async()=>{ for(const o of changed){ const {id,...body}=o; try{ await dbRefs[kind].doc(id).set(body); }catch(e){ toast("Import teilweise nicht gespeichert – bitte erneut importieren"); break; } } })();
    return {neu, upd, skip};
  }

  /* --- Export --- */
  function listDef(kind){
    if(kind==="kunden"){
      const rows=[...S.kunden].sort((a,b)=>(parseInt(kundenNr(a))||0)-(parseInt(kundenNr(b))||0));
      return { title:"Kontaktliste", file:"kontakte", rows,
        csvHead:["Kunden-Nr.","Name","Firma","Straße","PLZ","Ort","Land","Telefon","E-Mail","Aufträge","Umsatz brutto (EUR)"],
        csvRow:k=>{ const inv=S.rechnungen.filter(r=>r.kundeId===k.id&&dTyp(r)==="rechnung"&&r.nr&&!["entwurf","storniert"].includes(dStatus(r)));
          return [kundenNr(k),k.name,k.firma,k.strasse,k.plz,k.ort,k.land,k.tel,k.mail,S.auftraege.filter(a=>a.kundeId===k.id).length,(Math.round(inv.reduce((s,r)=>s+calc(r).brutto,0)*100)/100).toFixed(2).replace(".",",")]; },
        cols:[{h:"Knd.-Nr.",w:17,g:k=>kundenNr(k)},{h:"Name",w:45,g:k=>[k.name,k.firma&&k.firma!==k.name?k.firma:""].filter(Boolean).join("\n"),b:1},{h:"Ort",w:50,g:k=>[k.strasse,[k.land?landCode(k.land)+"-":"",k.plz?k.plz+" ":"",k.ort||""].join("").trim()].filter(Boolean).join("\n")},{h:"Telefon",w:27,g:k=>k.tel||""},{h:"E-Mail",w:31,g:k=>k.mail||""}] };
    }
    const rows=[...S.teile].sort((a,b)=>String(a.artnr||"").localeCompare(String(b.artnr||""),"de",{numeric:true})||(a.bez||"").localeCompare(b.bez||"","de"));
    return { title:"Produktliste", file:"produkte", rows,
      csvHead:["Artikelnummer","Bezeichnung","Kategorie","Einheit","Verkaufspreis (EUR)","Einkaufspreis (EUR)","Bestand","Lagerort"],
      csvRow:t=>[t.artnr,t.bez,t.kategorie||"Artikel",t.einheit||"Stk.",(+t.preis||0).toFixed(2).replace(".",","),t.ek!==""&&t.ek!=null?(+t.ek).toFixed(2).replace(".",","):"",t.kategorie==="Dienstleistung"?"":numIn(t.bestand||0),t.lager],
      cols:[{h:"Nr.",w:20,g:t=>t.artnr||""},{h:"Bezeichnung",w:72,g:t=>t.bez,b:1},{h:"Kategorie",w:24,g:t=>t.kategorie||"Artikel"},{h:"Einheit",w:15,g:t=>t.einheit||"Stk."},{h:"Preis",w:22,g:t=>eurTxt(t.preis),r:1},{h:"Bestand",w:17,g:t=>t.kategorie==="Dienstleistung"?"–":numIn(t.bestand||0),r:1}] };
  }
  function exportListCsv(kind){
    const D=listDef(kind); if(!D.rows.length){ toast("Keine Einträge zum Exportieren"); return; }
    const cell=v=>{ const s=String(v??""); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const csv="﻿"+[D.csvHead, ...D.rows.map(D.csvRow)].map(l=>l.map(cell).join(";")).join("\r\n")+"\r\n";
    saveFile(`repairmobile-${D.file}-${today()}.csv`, new Blob([csv],{type:"text/csv;charset=utf-8"}), `CSV mit ${D.rows.length} Einträgen bereit`);
  }
  function exportListPdf(kind){
    if(!window.jspdf){ toast("PDF-Erstellung nicht verfügbar"); return; }
    const D=typeof kind==="object" ? kind : listDef(kind); if(!D.rows.length){ toast("Keine Einträge zum Exportieren"); return; }
    const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:"mm",format:"a4"}); const f=S.firma, L=20, R=190, INK=[21,27,36], GREY=[93,102,115], ACC=hexRgb((ACCENTS[f.akzent]||ACCENTS.repair).c);
    let y=0;
    const head=(first)=>{ if(first){ try{ const src=docLogo(), p=doc.getImageProperties(src), ra=p.width/p.height; let w=46,h=w/ra; if(h>14){h=14;w=h*ra;} doc.addImage(src, src.startsWith("data:image/png")?"PNG":"JPEG", L, 14, w, h); }catch(e){}
        doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor(...INK); doc.text(D.title,R,20,{align:"right"});
        doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...GREY); doc.text((D.sub || `${f.name?f.name+" · ":""}Stand ${deDate(today())} · ${D.rows.length} Einträge`),R,25.5,{align:"right"}); y=38; } else y=20;
      doc.setFillColor(228,228,228); doc.rect(L,y,R-L,7,"F"); doc.setDrawColor(...ACC); doc.setLineWidth(.5); doc.line(L,y+7,R,y+7);
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...INK); let x=L; D.cols.forEach(c=>{ doc.text(c.h, c.r?x+c.w-2:x+2, y+4.7, c.r?{align:"right"}:undefined); x+=c.w; }); y+=7; };
    head(true);
    D.rows.forEach((row,i)=>{ doc.setFontSize(8); const cells=D.cols.map(c=>doc.splitTextToSize(String(c.g(row)??""), c.w-4)); const h=Math.max(...cells.map(cl=>cl.length))*3.5+3.6;
      if(y+h>280){ doc.addPage(); head(false); }
      if(i%2===1){ doc.setFillColor(243,244,246); doc.rect(L,y,R-L,h,"F"); }
      let x=L; D.cols.forEach((c,ci)=>{ cells[ci].forEach((ln,li)=>{ doc.setFont("helvetica", c.b&&li===0?"bold":"normal"); doc.setTextColor(...(li?GREY:INK)); doc.text(ln, c.r?x+c.w-2:x+2, y+4.6+li*3.5, c.r?{align:"right"}:undefined); }); x+=c.w; });
      y+=h; });
    if(D.total){ if(y+9>282){ doc.addPage(); head(false); } doc.setFillColor(228,228,228); doc.rect(L,y,R-L,8,"F"); doc.setFont("helvetica","bold"); doc.setFontSize(8.3); doc.setTextColor(...INK);
      let x=L; D.cols.forEach((c,ci)=>{ const v=D.total[ci]; if(v) doc.text(String(v), c.r?x+c.w-2:x+2, y+5.3, c.r?{align:"right"}:undefined); x+=c.w; }); y+=8; }
    const pages=doc.getNumberOfPages(); for(let pg=1;pg<=pages;pg++){ doc.setPage(pg); doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text(`${D.title} · Seite ${pg} von ${pages}`,105,290,{align:"center"}); }
    saveFile(D.fileName || `repairmobile-${D.file}-${today()}.pdf`, doc.output("blob"), "PDF-Liste bereit");
  }

  /* ---------- Rechnungen: Export (PDF-Liste, CSV, ZIP, DATEV) & Import ---------- */
  const EXF = {
    pdf:{l:"PDF-Liste", s:"PDF", d:"Übersicht aller Belege mit Summen"},
    csv:{l:"CSV (Excel)", s:"CSV", d:"Tabelle mit Netto, MwSt., Brutto und Status"},
    zip:{l:"ZIP-Archiv", s:"ZIP", d:"Alle Belege als einzelne PDFs plus Liste"},
    datev:{l:"DATEV (für Steuerberater)", s:"DATEV", d:"Buchungsstapel zum Einlesen in DATEV"}
  };
  function exportDocsMenu(){
    openPicker("Belege exportieren", Object.entries(EXF).map(([k,v])=>({label:v.l, sub:v.d, v:k})), o=>openExportDocs(o.v));
  }
  let EX=null;
  function exportRows(){
    const pre = EX.year==="alle" ? "" : EX.year + (EX.month ? "-"+EX.month : "");
    const art = EX.fmt==="datev" ? "rechnungen" : EX.art;
    return S.rechnungen.filter(r => (art==="rechnungen" ? dTyp(r)==="rechnung" : dTyp(r)!=="rechnung") && r.nr && dStatus(r)!=="entwurf"
        && (EX.fmt!=="datev" || dStatus(r)!=="storniert") && (r.datum||"").startsWith(pre))
      .sort((a,b)=>(a.datum||"").localeCompare(b.datum||"") || (a.nr||"").localeCompare(b.nr||"",undefined,{numeric:true}));
  }
  function datevDefaults(){ const f=S.firma, skr=f.datevSkr||"03";
    return { berater:f.datevBerater||"", mandant:f.datevMandant||"", skr, deb:f.datevDebitor||"10000",
      k19:f.datevKonto19||(skr==="04"?"4400":"8400"), k7:f.datevKonto7||(skr==="04"?"4300":"8300"),
      k0:f.datevKonto0||(f.kleinunternehmer?(skr==="04"?"4185":"8195"):(skr==="04"?"4200":"8200")) }; }
  function openExportDocs(fmt){
    const years=[...new Set([String(new Date().getFullYear()), ...S.rechnungen.map(r=>(r.datum||"").slice(0,4)).filter(Boolean)])].sort().reverse();
    EX = { fmt, art: UI.docSeg==="angebote" ? "angebote" : "rechnungen", year: years[0], month:"", years };
    openSheet("Belege exportieren", "", null, "", { foot:`<button class="btn accent wide" id="exGo">${ico.dl} Exportieren</button>` });
    renderExportBody();
    $("#exGo").onclick = runExport;
  }
  function readDatevForm(){ return { berater:val("dvB"), mandant:val("dvM"), skr:val("dvS")||"03", deb:val("dvD")||"10000", k19:val("dv19"), k7:val("dv7"), k0:val("dv0") }; }
  function renderExportBody(){
    const isD=EX.fmt==="datev"; if(isD && EX.year==="alle") EX.year=EX.years[0];
    const rows=exportRows(), sum=rows.reduce((s,r)=>s+calc(r).brutto,0), dv=EX.dv||datevDefaults();
    $("#sBody").innerHTML = `
      <div class="sec"><h4>${ico.dl}Format</h4>
        <div class="seg">${Object.entries(EXF).map(([k,v])=>`<button type="button" data-exf="${k}" aria-pressed="${EX.fmt===k}">${v.s}</button>`).join("")}</div>
        <p class="help" style="margin:0">${EXF[EX.fmt].d}.</p></div>
      ${isD?"":`<div class="sec"><h4>${ico.doc}Belege</h4><div class="seg"><button type="button" data-exa="rechnungen" aria-pressed="${EX.art==="rechnungen"}">Rechnungen</button><button type="button" data-exa="angebote" aria-pressed="${EX.art==="angebote"}">Angebote &amp; KVA</button></div></div>`}
      <div class="sec"><h4>${ico.cal}Zeitraum</h4><div class="csvrow">
        <select id="exY" class="input" aria-label="Jahr">${isD?"":`<option value="alle" ${EX.year==="alle"?"selected":""}>Alle Jahre</option>`}${EX.years.map(y=>`<option ${EX.year===y?"selected":""}>${y}</option>`).join("")}</select>
        <select id="exM" class="input" aria-label="Monat" ${EX.year==="alle"?"disabled":""}><option value="">Ganzes Jahr</option>${MONTHS.map((n,i)=>`<option value="${pad(i+1)}" ${EX.month===pad(i+1)?"selected":""}>${n}</option>`).join("")}</select></div>
        <div class="lineform" style="border-top:1px solid var(--line);padding-top:10px"><span class="lbl">${rows.length} Beleg${rows.length===1?"":"e"} ohne Entwürfe${isD?" und Stornos":""}</span><strong class="num">${eur(sum)}</strong></div></div>
      ${isD?`<div class="sec"><h4>${ico.table}DATEV-Angaben</h4>
        <p class="help" style="margin:0">Berater- und Mandantennummer bekommen Sie von Ihrem Steuerberater. Die Konten sind Standardwerte – lassen Sie sie beim ersten Mal kurz bestätigen.</p>
        <div class="box">
          <div class="field"><label for="dvB">Beraternummer</label><input id="dvB" inputmode="numeric" placeholder="z. B. 1234567" value="${esc(dv.berater)}"></div>
          <div class="field"><label for="dvM">Mandantennummer</label><input id="dvM" inputmode="numeric" placeholder="z. B. 10001" value="${esc(dv.mandant)}"></div>
          <div class="field"><label for="dvS">Kontenrahmen</label><select id="dvS"><option value="03" ${dv.skr==="03"?"selected":""}>SKR 03</option><option value="04" ${dv.skr==="04"?"selected":""}>SKR 04</option></select></div>
          <div class="field"><label for="dvD">Debitorenkonto</label><input id="dvD" class="mono" inputmode="numeric" value="${esc(dv.deb)}"></div>
          <div class="field"><label for="dv19">Erlöse 19 %</label><input id="dv19" class="mono" inputmode="numeric" value="${esc(dv.k19)}"></div>
          <div class="field"><label for="dv7">Erlöse 7 %</label><input id="dv7" class="mono" inputmode="numeric" value="${esc(dv.k7)}"></div>
          <div class="field"><label for="dv0">${S.firma.kleinunternehmer?"Erlöse § 19 UStG":"Erlöse 0 %"}</label><input id="dv0" class="mono" inputmode="numeric" value="${esc(dv.k0)}"></div>
        </div></div>`:""}`;
    const b=$("#sBody");
    $$("[data-exf]",b).forEach(x=>x.onclick=()=>{ if(EX.fmt==="datev") EX.dv=readDatevForm(); EX.fmt=x.dataset.exf; renderExportBody(); });
    $$("[data-exa]",b).forEach(x=>x.onclick=()=>{ EX.art=x.dataset.exa; renderExportBody(); });
    $("#exY").onchange=()=>{ if(isD) EX.dv=readDatevForm(); EX.year=$("#exY").value; if(EX.year==="alle") EX.month=""; renderExportBody(); };
    $("#exM").onchange=()=>{ if(isD) EX.dv=readDatevForm(); EX.month=$("#exM").value; renderExportBody(); };
    const dvS=$("#dvS"); if(dvS) dvS.onchange=()=>{ const cur=readDatevForm(); const d=datevDefaults(); const skr=cur.skr; const ku=S.firma.kleinunternehmer;
      EX.dv={...cur, k19:skr==="04"?"4400":"8400", k7:skr==="04"?"4300":"8300", k0:ku?(skr==="04"?"4185":"8195"):(skr==="04"?"4200":"8200")}; renderExportBody(); };
    const go=$("#exGo"); if(go){ go.disabled=!rows.length; go.style.opacity=rows.length?"":".5"; go.innerHTML=`${ico.dl} ${EXF[EX.fmt].s} exportieren`; }
  }
  function zeitLabel(){ return EX.year==="alle" ? "alle" : EX.year+(EX.month?"-"+EX.month:""); }
  async function runExport(){
    const rows=exportRows(); if(!rows.length){ toast("Keine Belege in diesem Zeitraum"); return; }
    const z=zeitLabel(), art=EX.fmt==="datev"?"rechnungen":EX.art;
    if(EX.fmt==="csv") return exportDocsCsv(rows, z, art);
    if(EX.fmt==="pdf") return exportDocsPdf(rows, z, art);
    if(EX.fmt==="zip") return exportDocsZip(rows, z, art);
    const dv=readDatevForm();
    if(!/^\d{3,7}$/.test(dv.berater) || !/^\d{1,5}$/.test(dv.mandant)){ toast("Bitte Berater- und Mandantennummer eintragen (nur Ziffern)"); ($("#dvB").value?$("#dvM"):$("#dvB")).focus(); return; }
    setFirma({datevBerater:dv.berater, datevMandant:dv.mandant, datevSkr:dv.skr, datevDebitor:dv.deb, datevKonto19:dv.k19, datevKonto7:dv.k7, datevKonto0:dv.k0});
    exportDatev(rows, dv);
  }
  const num2 = n => (Math.round((+n||0)*100)/100).toFixed(2).replace(".",",");
  function docsCsvText(rows){
    const cell=v=>{ const s=String(v??""); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const head=["Belegart","Nummer","Datum","Leistungsdatum","Fällig / gültig bis","Kunden-Nr.","Kunde","Kunden-Adresse","Gerät / Betreff","Netto (EUR)","MwSt-Satz (%)","MwSt (EUR)","Brutto (EUR)","Rabatt (%)","Status","Bezahlt am"];
    const lines=[head, ...rows.map(r=>{ const k=kunde(r.kundeId)||{}, c=calc(r);
      return [TYP[dTyp(r)].l, r.nr, deDate(r.datum), deDate(r.leistung||r.datum), deDate(r.faellig), k.id?kundenNr(k):"", k.firma&&k.firma!==k.name?`${k.firma} (${k.name||""})`:(k.name||""), [k.strasse,[k.plz,k.ort].filter(Boolean).join(" ")].filter(Boolean).join(", "), r.geraet||"",
        num2(c.netto), num2(c.p), num2(c.mwst), num2(c.brutto), r.rabatt?num2(r.rabatt):"", DST[dStatus(r)], r.bezahltAm?deDate(r.bezahltAm):""]; })];
    return "﻿"+lines.map(l=>l.map(cell).join(";")).join("\r\n")+"\r\n";
  }
  function exportDocsCsv(rows, zeit, art="rechnungen"){
    saveFile(`repairmobile-${art}-${zeit}.csv`, new Blob([docsCsvText(rows)],{type:"text/csv;charset=utf-8"}), `CSV mit ${rows.length} Beleg${rows.length===1?"":"en"} bereit`);
  }
  function exportDocsPdf(rows, zeit, art="rechnungen"){
    const sum=k=>rows.filter(r=>dStatus(r)!=="storniert").reduce((s,r)=>s+calc(r)[k],0);
    exportListPdf({ title: art==="rechnungen"?"Rechnungsliste":"Angebotsliste", file:`${art}-${zeit}`, fileName:`repairmobile-${art}-${zeit}.pdf`, rows,
      sub: `${S.firma.name?S.firma.name+" · ":""}${zeit==="alle"?"Alle Jahre":zeit.length===4?"Jahr "+zeit:MONTHS[+zeit.slice(5)-1]+" "+zeit.slice(0,4)} · ${rows.length} Belege`,
      cols:[{h:"Nummer",w:28,g:r=>r.nr,b:1},{h:"Datum",w:20,g:r=>deDate(r.datum)},{h:"Kunde",w:50,g:r=>{ const k=kunde(r.kundeId); return [k?.name||"–", r.geraet||""].filter(Boolean).join("\n"); }},{h:"Status",w:24,g:r=>DST[dStatus(r)]},{h:"Netto",w:24,g:r=>eurTxt(calc(r).netto),r:1},{h:"Brutto",w:24,g:r=>eurTxt(calc(r).brutto),r:1}],
      total:[`Summe${rows.some(r=>dStatus(r)==="storniert")?" (ohne Storno)":""}`,"","","",eurTxt(sum("netto")),eurTxt(sum("brutto"))] });
  }
  const safeName = s => String(s||"Beleg").replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g,"").replace(/-+/g,"-");
  async function exportDocsZip(rows, zeit, art="rechnungen"){
    if(!window.JSZip || !window.jspdf){ toast("ZIP-Erstellung nicht verfügbar"); return; }
    const go=$("#exGo"); const zip=new window.JSZip(); const used=new Set();
    for(let i=0;i<rows.length;i++){ const r=rows[i];
      if(go) go.textContent=`PDF ${i+1} von ${rows.length} …`;
      await new Promise(res=>setTimeout(res,0));
      let name=safeName(r.nr)+".pdf"; while(used.has(name)) name=name.replace(/\.pdf$/,"_2.pdf"); used.add(name);
      try{ zip.file(name, buildPdfDoc(r).output("arraybuffer")); }catch(e){ toast(`PDF für ${r.nr} fehlgeschlagen`); }
    }
    zip.file(`Belegliste-${zeit}.csv`, docsCsvText(rows));
    const blob=await zip.generateAsync({type:"blob", compression:"DEFLATE"});
    if(go) go.innerHTML=`${ico.dl} ZIP exportieren`;
    saveFile(`repairmobile-${art}-${zeit}.zip`, blob, `ZIP mit ${rows.length} PDF${rows.length===1?"":"s"} bereit`);
  }
  function toCp1252(str){
    const map={"€":0x80,"‚":0x82,"ƒ":0x83,"„":0x84,"…":0x85,"†":0x86,"‡":0x87,"ˆ":0x88,"‰":0x89,"Š":0x8A,"‹":0x8B,"Œ":0x8C,"Ž":0x8E,"‘":0x91,"’":0x92,"“":0x93,"”":0x94,"•":0x95,"–":0x96,"—":0x97,"˜":0x98,"™":0x99,"š":0x9A,"›":0x9B,"œ":0x9C,"ž":0x9E,"Ÿ":0x9F};
    const out=new Uint8Array(str.length); let n=0;
    for(const ch of str){ const c=ch.codePointAt(0); out[n++] = map[ch] ?? (c<256 && !(c>=0x80&&c<0xA0) ? c : 0x3F); }
    return out.slice(0,n);
  }
  function exportDatev(rows, dv){
    const y=EX.year, m=EX.month, now=new Date();
    const last = m ? new Date(+y, +m, 0).getDate() : 31;
    const from = m ? `${y}${m}01` : `${y}0101`, to = m ? `${y}${m}${pad(last)}` : `${y}1231`;
    const stamp=`${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}000`;
    const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
    const header=[q("EXTF"),700,21,q("Buchungsstapel"),13,stamp,"",q("RE"),q(""),q(""),dv.berater,dv.mandant,`${y}0101`,4,from,to,q(`Ausgangsrechnungen ${m?MONTHS[+m-1]+" ":""}${y}`.slice(0,30)),q(""),1,0,0,q("EUR"),"",q(""),"","",q(dv.skr),"","","",q("")].join(";");
    const cols=["Umsatz (ohne Soll/Haben-Kz)","Soll/Haben-Kennzeichen","WKZ Umsatz","Kurs","Basis-Umsatz","WKZ Basis-Umsatz","Konto","Gegenkonto (ohne BU-Schlüssel)","BU-Schlüssel","Belegdatum","Belegfeld 1","Belegfeld 2","Skonto","Buchungstext"].join(";");
    const lines=[header, cols];
    for(const r of rows){ const c=calc(r); if(!c.brutto) continue;
      const konto = c.p>=10 ? dv.k19 : c.p>0 ? dv.k7 : dv.k0;
      const k=kunde(r.kundeId);
      const beleg=String(r.nr||"").replace(/[^A-Za-z0-9$&%*+\-/]/g,"").slice(0,36);
      const text=[k?.name, r.geraet].filter(Boolean).join(", ").slice(0,60);
      lines.push([num2(Math.abs(c.brutto)), c.brutto<0?q("H"):q("S"), q("EUR"), "", "", "", dv.deb, konto, "", r.datum.slice(8,10)+r.datum.slice(5,7), q(beleg), "", "", q(text)].join(";"));
    }
    const bytes=toCp1252(lines.join("\r\n")+"\r\n");
    saveFile(`EXTF_Buchungsstapel_${safeName(S.firma.name||"RepairMobile")}_${y}${m||""}.csv`, new Blob([bytes],{type:"text/csv"}), `DATEV-Datei mit ${lines.length-2} Buchung${lines.length===3?"":"en"} bereit`);
  }

  /* --- Rechnungen importieren (z. B. sevdesk-Export „CSV (Excel)“) --- */
  IMPORT_FIELDS.rechnungen = [
    ["nr","Rechnungsnr.",["rechnungsnummer","rechnungsnr","rechnungnr","belegnummer","belegnr","invoicenumber","nummer","nr"]],
    ["datum","Datum",["rechnungsdatum","belegdatum","datum","date","erstelltam"]],
    ["leistung","Leistungsdatum",["leistungsdatum","lieferdatum","leistungszeitraum"]],
    ["faellig","Fällig am",["faelligkeit","faelligam","faelligkeitsdatum","zahlungsziel","faelligbis"]],
    ["kundennr","Kunden-Nr.",["kundennr","kundennummer","kndnr","kdnr","kontaktnr"]],
    ["kunde","Kunde",["kunde","kontakt","kundenname","kontaktname","empfaenger","rechnungsempfaenger","name","firma","organisation"]],
    ["betreff","Betreff",["betreff","titel","kopftext","beschreibung","bezeichnung","header"]],
    ["netto","Netto",["nettobetrag","betragnetto","netto","summenetto","gesamtnetto","nettosumme"]],
    ["mwst","MwSt.",["steuerbetrag","mwst","umsatzsteuer","ustbetrag","steuer","mwstbetrag","ust"]],
    ["satz","Steuersatz",["steuersatz","mwstsatz","ustsatz","steuersatzprozent"]],
    ["brutto","Brutto",["bruttobetrag","betragbrutto","brutto","summebrutto","gesamtbrutto","gesamtbetrag","betrag","rechnungsbetrag","bruttosumme"]],
    ["offen","Offen",["offenerbetrag","offen","restbetrag","ausstehend","offenbetrag"]],
    ["status","Status",["status","zahlungsstatus","rechnungsstatus"]],
    ["bezahltAm","Bezahlt am",["bezahltam","zahlungsdatum","bezahltdatum","zahldatum"]],
    ["art","Belegart",["belegart","rechnungsart","rechnungstyp","typ","art"]]
  ];
  function parseDateAny(v){ v=String(v||"").trim(); let m;
    if((m=v.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
    if((m=v.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/))){ const y=m[3].length===2?"20"+m[3]:m[3]; return `${y}-${pad(+m[2])}-${pad(+m[1])}`; }
    return ""; }
  const money = v => { const t=String(v||"").trim(); if(!t) return null; const n=parseNum(t.replace(/[^\d,.\-]/g,"")); return isNaN(n)?null:n; };
  function docRecords(rows, map){
    const get=(r,k)=> map[k]!=null ? (r[map[k]]||"").trim() : "";
    const out=[]; let storno=0, drafts=0;
    for(const r of rows){
      const nr=get(r,"nr"), datum=parseDateAny(get(r,"datum"));
      let brutto=money(get(r,"brutto")), netto=money(get(r,"netto")), mw=money(get(r,"mwst")), satz=money(get(r,"satz")), offen=money(get(r,"offen"));
      const st=normH(get(r,"status")), art=normH(get(r,"art"));
      if(!nr && !datum) continue;
      if(/entwurf|draft/.test(st) || !nr){ drafts++; continue; }
      if(/gutschrift|storno|korrektur/.test(art) || (brutto!=null && brutto<0)){ storno++; continue; }
      if(brutto==null && netto!=null) brutto = mw!=null ? netto+mw : satz!=null ? netto*(1+satz/100) : netto;
      if(brutto==null) continue;
      if(satz==null){ if(netto && Math.abs(netto)>0.004){ const raw=(brutto/netto-1)*100; satz=[0,7,19].reduce((a,b)=>Math.abs(b-raw)<Math.abs(a-raw)?b:a); if(Math.abs(satz-raw)>1.5) satz=Math.round(raw); } else satz = S.firma.kleinunternehmer ? 0 : 19; }
      let status="offen";
      if(/storn|cancel/.test(st)) status="storniert";
      else if(/teil/.test(st)) status="offen";
      else if(/bezahlt|paid|beglichen|ausgeglichen|erledigt/.test(st)) status="bezahlt";
      else if(!st && offen!=null) status = Math.abs(offen)<0.005 ? "bezahlt" : "offen";
      out.push({ nr, datum: datum||today(), leistung: parseDateAny(get(r,"leistung")), faellig: parseDateAny(get(r,"faellig")), kundennr:get(r,"kundennr"), kunde:get(r,"kunde"), betreff:get(r,"betreff"),
        brutto:r2(brutto), satz, status, bezahltAm: status==="bezahlt" ? parseDateAny(get(r,"bezahltAm")) : "" });
    }
    return {recs:out, storno, drafts};
  }
  function seqNo(nr, year){ const nums=(String(nr).match(/\d+/g)||[]).map(Number).filter(n=>n!==+year && n<100000); return nums.length ? Math.max(...nums) : 0; }
  function previewDocImport(fname, rows){
    if(rows.length<2){ toast("Die Datei enthält keine Datenzeilen"); return; }
    let hi=0, map={}; for(let i=0;i<Math.min(5,rows.length-1);i++){ const m=mapHeader("rechnungen", rows[i]); if(Object.keys(m).length>Object.keys(map).length){ map=m; hi=i; } }
    if(map.nr==null || (map.brutto==null && map.netto==null)){ toast("Spalten „Rechnungsnummer“ und „Betrag“ nicht gefunden"); return; }
    const {recs, storno, drafts}=docRecords(rows.slice(hi+1), map);
    if(!recs.length){ toast("Keine importierbaren Rechnungen gefunden"); return; }
    const exists=r=>S.rechnungen.some(d=>d.nr && normH(d.nr)===normH(r.nr));
    const findK=r=> (r.kundennr && S.kunden.find(k=>String(kundenNr(k))===String(r.kundennr))) || (r.kunde && S.kunden.find(k=>normH(k.name)===normH(r.kunde)||normH(k.firma)===normH(r.kunde)));
    const neu=recs.filter(r=>!exists(r)), dup=recs.length-neu.length;
    const newKunden=new Set(neu.filter(r=>r.kunde && !findK(r)).map(r=>normH(r.kunde))).size;
    const y=new Date().getFullYear(), seqMax=Math.max(0,...neu.filter(r=>r.datum.startsWith(String(y))).map(r=>seqNo(r.nr,y)));
    const ownMax=nrMax(S.rechnungen.filter(d=>dTyp(d)==="rechnung"), nrStem("rechnung"));
    const suggest = seqMax ? Math.max(seqMax, ownMax)+1 : 0;
    const sum=neu.reduce((s,r)=>s+r.brutto,0);
    const chips=IMPORT_FIELDS.rechnungen.filter(([k])=>map[k]!=null).map(([k,l])=>`<span class="mapchip"><b>${esc(l)}</b><span>← ${esc(rows[hi][map[k]])}</span></span>`).join("");
    const prev=recs.slice(0,8).map(r=>`<div class="ir"><span class="mono jobnr">${esc(r.nr)}</span><b>${esc(r.kunde||"Ohne Kunde")}</b><span class="num">${eur(r.brutto)}</span><small>${deDate(r.datum)} · ${DST[r.status]}${r.satz?` · ${numIn(r.satz)} % MwSt.`:""}${exists(r)?" · schon vorhanden":""}</small></div>`).join("");
    openSheet("Rechnungen importieren", `
      <div class="card"><h4>${ico.table}${esc(fname)}</h4><span style="color:var(--muted)">${recs.length} Rechnung${recs.length===1?"":"en"} erkannt · ${eur(sum)} brutto (neu)${drafts?` · ${drafts} Entwürfe übersprungen`:""}${storno?` · ${storno} Gutschriften/Stornos übersprungen`:""}.</span></div>
      <div class="group"><span class="glabel">Erkannte Spalten</span><div class="mapgrid">${chips}</div></div>
      <div class="group"><span class="glabel">Vorschau${recs.length>8?` (erste 8 von ${recs.length})`:""}</span><div class="box imprev">${prev}</div></div>
      <div class="card" style="gap:8px">
        <span>${neu.length} neu${dup?`, ${dup} schon vorhanden (werden übersprungen)`:""}${newKunden?` · ${newKunden===1?"1 neuer Kunde wird":newKunden+" neue Kunden werden"} angelegt`:""}.</span>
        ${suggest?`<div class="lineform" style="border-top:1px solid var(--line);padding-top:10px"><span><b style="font-weight:600">Nummern fortsetzen</b><br><small style="color:var(--muted)">Neue Rechnungen in der Werkbank starten mit ${esc(nrStem("rechnung"))}${pad4(suggest)}, damit sie an Ihre sevdesk-Nummern anschließen.</small></span><input type="checkbox" class="toggle" id="imSeq" checked></div>`:""}
        <p class="help" style="margin:0">Übernommen werden Nummer, Datum, Kunde, Betrag, Steuersatz und Status. Die einzelnen Positionen stehen nicht in der sevdesk-Liste – jede Rechnung bekommt eine Sammelposition. Die Original-PDFs aus sevdesk bleiben Ihre Belege.</p></div>
    `, null, "", { foot:`<button class="btn accent wide" id="imGo" ${neu.length?"":"disabled style='opacity:.5'"}>${ico.upl} ${neu.length} Rechnung${neu.length===1?"":"en"} importieren</button>` });
    $("#imGo").onclick=()=>{
      const createdK=new Map(), docs=[], kunden=[];
      for(const r of neu){
        let k=findK(r);
        if(!k && r.kunde){ const key=normH(r.kunde); k=createdK.get(key); if(!k){ k={id:uid(), nr:r.kundennr||nextKundenNr(), name:r.kunde, created:today()}; createdK.set(key,k); upsertLocal("kunden",k); kunden.push(k); } }
        const bez = r.betreff || `Leistungen gemäß Rechnung ${r.nr}`;
        docs.push({ id:uid(), typ:"rechnung", nr:r.nr, status:r.status, kundeId:k?.id||"", auftragId:"", geraet:r.betreff||"", imei:"", datum:r.datum, leistung:r.leistung||r.datum, faellig:r.faellig||r.datum,
          positionen:[{bez, menge:1, einheit:"psch.", preis:r.brutto}], mwst:r.satz, brutto:true, rabatt:0, notiz:"", importiert:true, bezahltAm:r.bezahltAm||"",
          verlauf:[{t:nowStamp(), e:`Importiert aus ${fname}`}], created:nowStamp() });
      }
      docs.forEach(d=>upsertLocal("rechnungen",d));
      const seq=$("#imSeq"); if(suggest && seq && seq.checked) S.firma={...S.firma, reStart:suggest, reStartYear:y};
      lsSave(); closeSheet(); UI.view="rechnungen"; UI.docSeg="rechnungen"; UI.docFilter="alle"; render();
      if(mode==="db") (async()=>{ try{ if(suggest && seq && seq.checked) await dbRefs.firma.set(S.firma);
        for(const k of kunden){ const {id,...b}=k; await dbRefs.kunden.doc(id).set(b); }
        for(const d of docs){ const {id,...b}=d; await dbRefs.rechnungen.doc(id).set(b); } }catch(e){ toast("Import teilweise nicht gespeichert – bitte erneut importieren"); } })();
      toast(`${docs.length} Rechnung${docs.length===1?"":"en"} importiert${kunden.length?`, ${kunden.length} Kunde${kunden.length===1?"":"n"} angelegt`:""}`);
    };
  }

  /* ---------- Datensicherung ---------- */
  const BACKUP_APP = "repairmobile-werkbank";
  async function exportBackup(){
    const belegBilder={}; for(const x of S.ausgaben) if(x.bild){ const b=await BILD.get(x.id); if(b) belegBilder[x.id]=b; }
    const data = { app:BACKUP_APP, version:2, exportiert:nowStamp(), firma:{...S.firma, geminiApiKey:undefined}, kunden:S.kunden, auftraege:S.auftraege, rechnungen:S.rechnungen, teile:S.teile, ausgaben:S.ausgaben, belegBilder };
    const filename = `repairmobile-backup-${today()}.json`;
    saveFile(filename, new Blob([JSON.stringify(data, null, 2)], {type:"application/json"}), `Backup gespeichert: ${filename}`);
  }
  function importBackup(event){
    const input = event.target; const file = input.files && input.files[0];
    if(!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      input.value = "";
      let data;
      try{ data = JSON.parse(rd.result); }catch(e){ toast("Die Datei ist kein gültiges Backup (kein JSON)"); return; }
      if(!data || typeof data!=="object" || Array.isArray(data) || (data.app && data.app!==BACKUP_APP)){ toast("Diese Datei ist kein RepairMobile-Backup"); return; }
      const clean = { exportiert: data.exportiert || "", firma: (data.firma && typeof data.firma==="object" && !Array.isArray(data.firma)) ? data.firma : {} };
      clean.belegBilder = (data.belegBilder && typeof data.belegBilder==="object" && !Array.isArray(data.belegBilder)) ? data.belegBilder : {};
      for(const c of COLLS) clean[c] = Array.isArray(data[c]) ? data[c].filter(o => o && typeof o==="object" && typeof o.id==="string" && o.id) : [];
      if(!Object.keys(clean.firma).length && COLLS.every(c=>!clean[c].length)){ toast("Das Backup enthält keine Daten"); return; }
      UI.pendingImport = clean; UI.view = "mehr"; render();
      $("#backupFile")?.closest(".card")?.scrollIntoView({block:"center", behavior:"smooth"});
    };
    rd.onerror = () => toast("Datei konnte nicht gelesen werden");
    rd.readAsText(file);
  }
  async function applyBackup(data){
    if(!data) return;
    UI.pendingImport = null;
    S.firma = {...data.firma, geminiApiKey: data.firma.geminiApiKey || S.firma.geminiApiKey || "", geminiModel: data.firma.geminiModel || S.firma.geminiModel || ""};
    const before={}; for(const c of COLLS) before[c]=S[c].map(x=>x.id);
    for(const c of COLLS) S[c] = data[c].map(o=>({...o}));
    try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){}
    render();
    if(cloudOn()){ for(const c of COLLS){ const keep=new Set(S[c].map(x=>x.id)); before[c].filter(id=>!keep.has(id)).forEach(id=>cloudQueue(c, id, null, true)); }
      const now=Date.now(); for(const c of COLLS) S[c].forEach(x=>x._upd=now); S.firma._upd=now; cloudQueueAll(); }
    for(const [id,b] of Object.entries(data.belegBilder||{})) if(b && typeof b.data==="string" && /^data:/.test(b.data)) await BILD.put(id, {typ:b.typ, data:b.data, name:b.name, size:b.size});
    if(mode==="db"){
      toast("Wiederherstellen läuft …");
      try{
        await dbRefs.firma.set(S.firma);
        for(const c of COLLS){
          const keep = new Set(data[c].map(o=>o.id));
          const cur = await dbRefs[c].get();
          for(const d of cur.docs) if(!keep.has(d.id)) await dbRefs[c].doc(d.id).delete();
          for(const o of data[c]){ const {id, ...body} = o; await dbRefs[c].doc(id).set(body); }
        }
      }catch(e){ toast("Wiederherstellen unvollständig – bitte erneut versuchen"); return; }
    }
    toast(`Backup wiederhergestellt: ${S.kunden.length} Kunden, ${S.auftraege.length} Aufträge, ${S.rechnungen.length} Belege, ${S.ausgaben.length} Ausgaben`);
  }


  /* ---------- Header: Suche, Menü, Tour ---------- */
  const ICON_DOTS = {
    teile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
    text:ico.text, backup:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
    design:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.9 1.2-1.7-.4-1 .3-2.3 1.6-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/></svg>',
    help:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.8M12 17.3h.01"/></svg>',
    example:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.4 7 18.2l1.2-5.6L4 8.8l5.6-.6z"/></svg>'
  };
  function gotoGroup(id){ closeMenu(); UI.view="mehr"; render(); requestAnimationFrame(()=>{ const g=$("#"+id); if(g){ g.scrollIntoView({block:"start",behavior:"smooth"}); } }); }
  function openMenu(){
    const m=$("#menu"), items=[
      {k:"teile", l:"Ersatzteile & Lager", f:()=>gotoGroup("grpTeile")},
      {k:"text", l:"Textbausteine", f:()=>{ closeMenu(); openTexte(); }},
      {k:"design", l:"Design & PDF-Layout", f:()=>gotoGroup("grpDesign")},
      {k:"backup", l:"Datensicherung", f:()=>gotoGroup("grpBackup")},
      ...(S.auftraege.length?[]:[{k:"example", l:"Beispiel-Daten laden", f:()=>{ closeMenu(); loadExamples(); }}]),
      {hr:true},
      {k:"help", l:"Tour-Hilfe", f:()=>{ closeMenu(); startTour(UI.view); }}
    ];
    m.innerHTML=items.map((it,i)=>it.hr?"<hr>":`<button role="menuitem" data-mi="${i}">${ICON_DOTS[it.k]}${esc(it.l)}</button>`).join("");
    m.onclick=e=>{ const b=e.target.closest("[data-mi]"); if(b) items[+b.dataset.mi].f(); };
    const top=$(".top").getBoundingClientRect().bottom; m.style.top=(top+6)+"px";
    m.hidden=false; $("#mscrim").hidden=false; $("#btnMenu").setAttribute("aria-expanded","true");
    m.querySelector("button")?.focus();
  }
  function closeMenu(){ $("#menu").hidden=true; $("#mscrim").hidden=true; $("#btnMenu").setAttribute("aria-expanded","false"); }
  $("#btnMenu").onclick=()=> $("#menu").hidden ? openMenu() : closeMenu();
  $("#mscrim").onclick=closeMenu;
  $("#btnSearch").onclick=()=>openSearch();
  document.addEventListener("keydown", e=>{ if(e.key!=="Escape") return; if(!$("#tour").hidden) endTour(); else if(!$("#menu").hidden) closeMenu(); });

  /* recents for the search sheet */
  function getRecent(){ try{ return JSON.parse(localStorage.getItem("rm-recent")||"[]"); }catch(e){ return []; } }
  function pushRecent(t,id){ const list=[{t,id}, ...getRecent().filter(x=>!(x.t===t&&x.id===id))].slice(0,8); try{ localStorage.setItem("rm-recent", JSON.stringify(list)); }catch(e){} }

  function hl(text, q){ const s=esc(text); if(!q) return s; const i=String(text).toLowerCase().indexOf(q); if(i<0) return s; return esc(String(text).slice(0,i))+"<mark>"+esc(String(text).slice(i,i+q.length))+"</mark>"+esc(String(text).slice(i+q.length)); }
  function sRow(type, id, title, sub, pill, q){
    const icon={job:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/></svg>', kunde:ico.user, doc:ico.doc, termin:ico.cal}[type];
    return `<button class="srow" data-st="${type==="termin"?"job":type}" data-sid="${id}"><span class="sicon si-${type}">${icon}</span><span style="min-width:0"><b>${hl(title,q)}</b><small>${hl(sub,q)}</small></span>${pill?`<span class="pill s-${pill[0]}">${pill[1]}</span>`:"<span></span>"}${ico.right}</button>`;
  }
  const rowJob = (a,q,asTermin) => sRow(asTermin?"termin":"job", a.id, a.geraet||"Gerät", asTermin ? `${longDate(a.termin)}${a.termin.length>10?", "+a.termin.slice(11,16)+" Uhr":""} · ${kName(a.kundeId)}` : `#${a.nr} · ${kName(a.kundeId)}`, [a.status, STATUS[a.status].l], q);
  const rowKunde = (k,q) => sRow("kunde", k.id, k.name, [k.tel, k.mail, [k.plz,k.ort].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "Kunde", null, q);
  const rowDoc = (r,q) => { const st=dStatus(r); return sRow("doc", r.id, r.nr || `${TYP[dTyp(r)].l} (Entwurf)`, `${kName(r.kundeId)} · ${eur(calc(r).brutto)}`, [st, DST[st]], q); };
  function searchResults(raw){
    const q=raw.trim().toLowerCase();
    const grp=(t,rows)=>rows.length?`<div class="group"><span class="glabel">${t}</span><div class="slist">${rows.join("")}</div></div>`:"";
    if(!q){
      const rec=getRecent().map(x=> x.t==="job" ? (S.auftraege.find(a=>a.id===x.id)&&rowJob(S.auftraege.find(a=>a.id===x.id))) : x.t==="doc" ? (S.rechnungen.find(r=>r.id===x.id)&&rowDoc(S.rechnungen.find(r=>r.id===x.id))) : (kunde(x.id)&&rowKunde(kunde(x.id)))).filter(Boolean);
      const next=S.auftraege.filter(a=>a.termin && a.termin.slice(0,10)>=today() && a.status!=="abgeholt").sort((a,b)=>a.termin.localeCompare(b.termin)).slice(0,5).map(a=>rowJob(a,"",true));
      const out=grp("Zuletzt",rec)+grp("Nächste Termine",next);
      return out || `<div class="empty"><p>Suchen Sie nach Gerät, Auftragsnummer, IMEI, Kunde, Telefonnummer, Rechnungsnummer oder Datum (z. B. 13.10.).</p></div>`;
    }
    const has=(...v)=>v.filter(Boolean).join(" ").toLowerCase().includes(q);
    const jobs=S.auftraege.filter(a=>has(a.geraet,a.nr,a.problem,a.imei,a.zubehoer,kName(a.kundeId))).slice(0,20).map(a=>rowJob(a,q));
    const ter=S.auftraege.filter(a=>a.termin && has(deDate(a.termin), longDate(a.termin), a.termin.slice(11,16))).sort((a,b)=>a.termin.localeCompare(b.termin)).slice(0,20).map(a=>rowJob(a,q,true));
    const kun=S.kunden.filter(k=>has(k.name,k.firma,k.tel,k.mail,k.strasse,k.ort,k.plz)).slice(0,20).map(k=>rowKunde(k,q));
    const docs=S.rechnungen.filter(r=>has(r.nr,TYP[dTyp(r)].l,r.geraet,kName(r.kundeId))).slice(0,20).map(r=>rowDoc(r,q));
    const out=grp("Aufträge",jobs)+grp("Termine",ter)+grp("Kunden",kun)+grp("Rechnungen & Angebote",docs);
    return out || `<div class="empty"><p>Nichts gefunden für „${esc(raw.trim())}“.</p></div>`;
  }
  function openSearch(){
    closeMenu();
    openSheet("Suchen", `<label class="ssearch">${ico.search}<input id="sq" type="search" placeholder="Aufträge, Kunden, Termine suchen…" autocomplete="off" enterkeyhint="search"></label><div id="sres" style="display:flex;flex-direction:column;gap:16px">${searchResults("")}</div>`, null, "", {cancelLabel:"Schließen"});
    const inp=$("#sq"); inp.oninput=()=>{ $("#sres").innerHTML=searchResults(inp.value); };
    $("#sres").onclick=e=>{ const b=e.target.closest("[data-sid]"); if(!b) return; const t=b.dataset.st, id=b.dataset.sid; if(t==="job") openJobDetail(id); else if(t==="doc") openDoc(id); else openKunde(id); };
    setTimeout(()=>inp.focus(), 280);
  }

  /* guided tour with speech bubbles */
  const TOURS = {
    auftraege:[
      {sel:"#fab", t:"Neuen Auftrag erstellen", x:"Tippen Sie hier, um ein Gerät anzunehmen – mit Kunde, Fehlerbeschreibung, Termin und Ersatzteilen."},
      {sel:"#main .chips", t:"Aufträge filtern", x:"Wechseln Sie zwischen offenen, abholbereiten und abgeholten Aufträgen."},
      {sel:"#main [data-job]", t:"Auftrag öffnen", x:"Im Auftrag ändern Sie den Status, tragen „Heute repariert“ ein und erstellen Rechnung oder Kostenvoranschlag."},
      {sel:"#btnSearch", t:"Alles finden", x:"Die Lupe durchsucht Aufträge, Kunden, Termine und Rechnungen auf einmal – auch nach IMEI oder Datum."},
      {sel:"#btnMenu", t:"Mehr & Hilfe", x:"Hier finden Sie Ersatzteile, Textbausteine, Datensicherung und diese Tour."}
    ],
    kalender:[
      {sel:"#main .grid", t:"Monatsübersicht", x:"Blaue Punkte sind Termine, grüne Punkte Reparaturen, graue Abholungen. Tippen Sie auf einen Tag."},
      {sel:"#main .calhead", t:"Monat wechseln", x:"Mit den Pfeilen blättern Sie, „Heute“ springt zurück zum aktuellen Tag."},
      {sel:"#dayList", t:"Tagesübersicht", x:"Alles, was am gewählten Tag ansteht oder erledigt wurde. Tippen öffnet den Auftrag."},
      {sel:"#fab", t:"Termin anlegen", x:"Legt einen neuen Auftrag mit Termin direkt am gewählten Tag an."}
    ],
    rechnungen:[
      {sel:"#main .seg", t:"Rechnungen und Angebote", x:"Oben wechseln Sie zwischen Rechnungen und Angeboten bzw. Kostenvoranschlägen."},
      {sel:"#main .tri", t:"Auf einen Blick", x:"Wie viel noch offen ist, was überfällig ist und was schon bezahlt wurde."},
      {sel:"#main [data-doc]", t:"Beleg öffnen", x:"Übersicht mit Blatt-Ansicht, PDF zum Teilen, Verlauf und Status."},
      {sel:"#fab", t:"Neues Dokument", x:"Rechnung, Angebot oder Kostenvoranschlag anlegen. Oben rechts sehen Sie vorher die Vorschau."}
    ],
    kunden:[
      {sel:"#main .search", t:"Kunden finden", x:"Nach Name, Telefonnummer oder E-Mail filtern."},
      {sel:"#main [data-kunde]", t:"Kunde öffnen", x:"Kontakt, Rechnungsadresse und alle Aufträge und Belege dieses Kunden."},
      {sel:"#fab", t:"Kunde anlegen", x:"Neue Kunden legen Sie hier an – oder direkt beim Auftrag."}
    ],
    mehr:[
      {sel:"#main [data-act=firma]", t:"Firmendaten", x:"Name, Adresse, Bankverbindung, Steuernummer und Logo für Ihre Belege."},
      {sel:"#grpTexte", t:"Textbausteine", x:"Garantie-Hinweis und Haftungsausschluss, die automatisch auf Ihre Belege kommen."},
      {sel:"#grpDesign", t:"Design & Layout", x:"Hell oder dunkel, Akzentfarbe, PDF-Design und der „BEZAHLT“-Stempel."},
      {sel:"#grpBackup", t:"Datensicherung", x:"Backup herunterladen, wiederherstellen und Rechnungen als CSV für den Steuerberater exportieren."}
    ]
  };
  let TS=null;
  function startTour(view){
    if(!$("#sheet").hidden) closeSheet();
    const steps=(TOURS[view]||[]).filter(s=>$(s.sel)); if(!steps.length){ toast("Für diese Ansicht gibt es noch keine Tour"); return; }
    TS={view, steps, i:0}; $("#tour").hidden=false; showStep();
  }
  function endTour(){ if(TS){ try{ localStorage.setItem("rm-tour-"+TS.view,"1"); }catch(e){} } TS=null; $("#tour").hidden=true; }
  function showStep(){
    const st=TS.steps[TS.i], n=TS.steps.length, el=$(st.sel), ring=$("#tRing"), bub=$("#tBub"), tour=$("#tour");
    bub.innerHTML=`<div class="t-head"><span class="t-num">${TS.i+1}</span><h3 id="tTitle">${esc(st.t)}</h3><button class="t-x" id="tX" aria-label="Tour beenden">×</button></div>
      <p>${esc(st.x)}</p><div class="t-foot"><span>${TS.i+1} von ${n}</span>${TS.i?`<button class="t-back" id="tBack">Zurück</button>`:""}<button class="t-next" id="tNext">${TS.i===n-1?"Fertig":"Weiter"}</button></div>
      <div class="t-dots">${TS.steps.map((_,i)=>`<i class="${i===TS.i?"on":""}"></i>`).join("")}</div>`;
    $("#tX").onclick=endTour; $("#tNext").onclick=()=>{ if(TS.i<n-1){ TS.i++; showStep(); } else endTour(); };
    const tb=$("#tBack"); if(tb) tb.onclick=()=>{ TS.i--; showStep(); };
    const fixed = el && getComputedStyle(el).position==="fixed" || el?.closest(".top,.tabs");
    if(el && !fixed){ const r0=el.getBoundingClientRect(); if(r0.top<80 || r0.bottom>innerHeight-180) el.scrollIntoView({block:"center"}); }
    requestAnimationFrame(()=>{
      if(!el){ tour.classList.add("noring"); ring.hidden=true; bub.style.top=Math.max(80,(innerHeight-bub.offsetHeight)/2)+"px"; return; }
      tour.classList.remove("noring"); ring.hidden=false;
      const r=el.getBoundingClientRect(), pad=6, maxH=Math.min(r.height+pad*2, innerHeight*.45);
      Object.assign(ring.style,{left:(r.left-pad)+"px", top:(r.top-pad)+"px", width:(r.width+pad*2)+"px", height:maxH+"px", borderRadius: el.matches("#fab,.iconbtn")?"50%":"18px"});
      const bh=bub.offsetHeight, below=innerHeight-(r.top-pad+maxH);
      bub.style.top = (below > bh+24 ? (r.top-pad+maxH+14) : Math.max(12, r.top-pad-bh-14)) + "px";
      $("#tNext").focus();
    });
  }
  window.addEventListener("resize", ()=>{ if(TS) showStep(); });


  /* tab bar shrinks while scrolling down, expands when scrolling up */
  (()=>{ let last=window.scrollY, ticking=false; const bar=$("#tabs");
    const upd=()=>{ const y=window.scrollY, d=y-last;
      if(y<24) bar.classList.remove("compact");
      else if(d>6) bar.classList.add("compact");
      else if(d<-6) bar.classList.remove("compact");
      if(Math.abs(d)>6||y<24) last=y; ticking=false; };
    window.addEventListener("scroll", ()=>{ if(!ticking){ ticking=true; requestAnimationFrame(upd); } }, {passive:true});
    bar.addEventListener("click", ()=>bar.classList.remove("compact"));
  })();

  /* ---------- start ---------- */
  document.addEventListener("touchstart", ()=>{}, {passive:true});
  applyTheme(); lsLoad(); render(); connectDb(); authBoot();
  // first visit: show the short tour for Aufträge once
  setTimeout(()=>{ let seen=false; try{ seen=!!localStorage.getItem("rm-tour-auftraege"); }catch(e){} if(!seen && UI.view==="auftraege" && $("#sheet").hidden && !$("#auth:not([hidden])")) startTour("auftraege"); }, 900);
}
