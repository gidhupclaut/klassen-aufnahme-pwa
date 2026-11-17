const CACHE_NAME = "klassen-aufnahme-v18";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css?v=16",
  "./js/app.js?v=16",
  "./js/db.js?v=16",
  "./js/recorder.js?v=16",
  "./js/share.js?v=16",
  "./js/pcsync.js?v=16",
  "./js/pdf.js?v=16",
  "./js/scanner.js?v=16",
  "./js/warp.js?v=16",
  "./js/cropper.js?v=16",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  // Jede Datei über eine mit CACHE_NAME durchmischte URL laden - das ist
  // garantiert eine neue URL, die der Browser-HTTP-Cache nie zuvor gesehen
  // hat, und landet trotzdem unter dem sauberen Original-Pfad im Cache,
  // damit die Fetch-Anfragen zur Laufzeit (ohne Zusatz-Parameter) ihn finden.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        APP_SHELL.map(async (url) => {
          const bustUrl = url + (url.includes("?") ? "&" : "?") + "swv=" + CACHE_NAME;
          const response = await fetch(bustUrl);
          await cache.put(url, response);
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
