const CACHE_NAME = "klassen-aufnahme-v15";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css?v=14",
  "./js/app.js?v=14",
  "./js/db.js?v=14",
  "./js/recorder.js?v=14",
  "./js/share.js?v=14",
  "./js/pcsync.js?v=14",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  // Jede Datei explizit mit cache:"reload" vom Netzwerk holen (nicht aus dem
  // Browser-HTTP-Cache) - sonst kann z.B. ein alter index.html-Stand trotz
  // neuer Service-Worker-Version weiter ausgeliefert werden.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        APP_SHELL.map(async (url) => {
          const response = await fetch(url, { cache: "reload" });
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
