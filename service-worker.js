const CACHE_NAME = "klassen-aufnahme-v21";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css?v=18",
  "./js/app.js?v=18",
  "./js/db.js?v=18",
  "./js/recorder.js?v=18",
  "./js/share.js?v=18",
  "./js/pcsync.js?v=18",
  "./js/pdf.js?v=18",
  "./js/scanner.js?v=18",
  "./js/warp.js?v=18",
  "./js/cropper.js?v=18",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  // Jede Datei über eine mit CACHE_NAME durchmischte URL laden - das ist
  // garantiert eine neue URL, die der Browser-HTTP-Cache nie zuvor gesehen
  // hat, und landet trotzdem unter dem sauberen Original-Pfad im Cache,
  // damit die Fetch-Anfragen zur Laufzeit (ohne Zusatz-Parameter) ihn finden.
  // Nacheinander statt parallel (Promise.all) + ein paar Wiederholversuche:
  // robuster gegenüber einzelnen fehlschlagenden Requests (z.B. auf
  // instabilem WLAN), als wenn ein einziger Fehlschlag das ganze
  // Precaching abbricht.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const url of APP_SHELL) {
        const bustUrl = url + (url.includes("?") ? "&" : "?") + "swv=" + CACHE_NAME;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(bustUrl);
            await cache.put(url, response);
            break;
          } catch (err) {
            if (attempt === 2) console.warn("Precache fehlgeschlagen fuer", url, err);
          }
        }
      }
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
