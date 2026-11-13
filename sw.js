const CACHE = "pup-ledger-v24";
const FILES = ["./", "index.html", "style.css", "app.js", "manifest.json", "logo.svg", "logo.png", "placeholder.jpeg"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request))));
