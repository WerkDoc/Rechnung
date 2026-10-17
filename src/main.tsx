import React from "react";
import { createRoot } from "react-dom/client";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import App from "./App.jsx";
import "./styles.css";

// PDF- und ZIP-Erzeugung erwarten diese global (wie vorher über das CDN).
window.jspdf = { jsPDF };
window.JSZip = JSZip;

// Läuft die App vom Home-Bildschirm? Dann Klasse setzen (für Statusleiste & Abstände).
const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
document.documentElement.classList.toggle("is-standalone", standalone);

createRoot(document.getElementById("root")).render(<App />);

if (import.meta.env.PROD) {
  // Offline-Fähigkeit
  let swReg = null;
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").then((r) => { swReg = r; }).catch(() => {});
    });
  }

  // Versions-Check: Nach dem Entsperren des iPhones lädt iOS die App manchmal neu, bevor das Netz bereit ist –
  // dann kann kurz eine ältere Version erscheinen. Beim Zurückkehren, beim Start und wenn das Netz wieder da ist
  // wird geprüft, ob es eine neuere Version gibt, und sie wird geladen (nur wenn gerade nichts geöffnet ist).
  const currentJs = () => (document.querySelector('script[type="module"][src*="assets/"]')?.getAttribute("src") || "").replace(/^.*assets\//, "");
  const isBusy = () => {
    const open = (id) => { const el = document.getElementById(id); return el && !el.hidden; };
    const a = document.activeElement;
    return open("sheet") || open("picker") || open("viewer") || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName));
  };
  let pendingReload = false, checking = false;
  async function checkVersion() {
    if (checking || navigator.onLine === false) return;
    checking = true;
    try {
      swReg?.update?.().catch(() => {});
      const res = await fetch("./index.html?v=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      const m = (await res.text()).match(/assets\/(index-[\w-]+\.js)/);
      if (!m || !currentJs() || m[1] === currentJs()) return;
      // Schutz vor Endlosschleifen: höchstens 2 automatische Neuladungen pro Minute
      const key = "rm-reload", now = Date.now();
      const hist = JSON.parse(sessionStorage.getItem(key) || "[]").filter((t) => now - t < 60000);
      if (hist.length >= 2) return;
      if (isBusy()) { pendingReload = true; return; }
      sessionStorage.setItem(key, JSON.stringify([...hist, now]));
      location.reload();
    } catch (e) {} finally { checking = false; }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(checkVersion, 800); });
  window.addEventListener("pageshow", () => setTimeout(checkVersion, 800));
  window.addEventListener("online", () => setTimeout(checkVersion, 1500));
  window.addEventListener("load", () => setTimeout(checkVersion, 3000));
  // Wartet ein Update, weil gerade ein Formular offen war: nach dem Schließen nachholen
  setInterval(() => { if (pendingReload && !isBusy()) { pendingReload = false; checkVersion(); } }, 2000);
  // Browser bitten, die App-Daten dauerhaft zu behalten (nicht automatisch löschen)
  navigator.storage?.persist?.().catch(() => {});
}
