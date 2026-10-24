// RepairMobile Werkbank – Service Worker
// Hält die App offline verfügbar. Jede neue Version bekommt einen eigenen Speicher; alte Dateien werden gelöscht.
const CACHE = "werkbank-20261024145930";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./apple-touch-icon.png", "./icons/icon-192.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  // cache:"reload" = am HTTP-Zwischenspeicher von GitHub vorbei, immer die frische Version
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "reload" })))).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Seiten: immer frisch vom Server (ohne HTTP-Zwischenspeicher). Nur wenn das Netz nach dem
  // Aufwachen noch nicht bereit ist (> 4 s) oder fehlt, die zuletzt gespeicherte Seite nehmen.
  if (req.mode === "navigate") {
    const net = fetch(req.url, { cache: "no-store", credentials: "same-origin" })
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); } return res; });
    e.respondWith(
      Promise.race([net.catch(() => null), new Promise((r) => setTimeout(() => r(null), 4000))])
        .then((res) => res || caches.match("./index.html").then((hit) => hit || net))
    );
    return;
  }

  // App-Dateien und Schriften: sofort aus dem Cache, im Hintergrund aktualisieren
  const cacheable = url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
