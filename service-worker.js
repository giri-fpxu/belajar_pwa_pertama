const CACHE_NAME = "rentrack-v5";
const BASE_URL = self.registration.scope;

const urlsToCache = [
  `${BASE_URL}`,
  `${BASE_URL}index.html`,
  `${BASE_URL}offline.html`,
  `${BASE_URL}manifest.json`,
  `${BASE_URL}assets/style.css`,
  `${BASE_URL}icons/app-icon-192.png`,
  `${BASE_URL}icons/app-icon-512.png`,
];

// Install Service Worker & cache assets
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.error("Cache gagal dimuat:", err))
  );
});

// Activate & delete old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("Menghapus cache lama:", key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch: cache-first for local, network-first for external
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore chrome extensions, non-GET requests
  if (url.protocol.startsWith("chrome-extension")) return;
  if (request.method !== "GET") return;

  // Local (static) files
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(response => {
        if (response) return response;
        return fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            if (request.mode === "navigate") {
              return caches.match(`${BASE_URL}offline.html`);
            }
            return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
          });
      })
    );
  }
  // External resources (CDN, APIs, etc.)
  else {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  }
});
