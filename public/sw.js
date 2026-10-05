const CACHE_NAME = "app-assets-v2";
const OFFLINE_URL = "/offline.html";
// The SPA serves the same HTML (the app shell) for every route. The last shell
// loaded online is saved under this key so the app can open offline.
const SHELL_URL = "/";
// Never precache the shell at install. Its HTML embeds Vite-hashed asset URLs,
// and only a shell saved during a real page load has its chunks cached with it.
const urlsToCache = [
  OFFLINE_URL,
  "/icon/icon-192.png",
  "/icon/icon-512.png",
  "/icon/icon-maskable-192.png",
  "/icon/icon-maskable-512.png",
];
const matchCached = (request) => caches.match(request, { cacheName: CACHE_NAME });
const isHtml = (response) => (response.headers.get("content-type") ?? "").includes("text/html");

// Install event - cache the offline page and icons (not the app shell).
// allSettled so one missing asset does not abort the whole install.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(urlsToCache.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

// Fetch event - network first, fall back to cache
self.addEventListener("fetch", (event) => {
  // Only handle GET requests - POST/PUT/DELETE cannot be cached
  if (event.request.method !== "GET") {
    return;
  }

  // Never intercept cross-origin requests. The Hercules CDN and other third parties already set their own HTTP cache headers
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept auth paths.
  if (url.pathname.startsWith("/auth")) {
    return;
  }

  // Navigation requests are network-first, so an online load always gets the
  // latest publish. Each successful load saves its HTML as the app shell. When
  // the network fails, open the saved shell, else the offline page.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && isHtml(response)) {
            const shellToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, shellToCache));
          }
          return response;
        })
        .catch(() =>
          matchCached(SHELL_URL)
            .then((shell) => shell ?? matchCached(OFFLINE_URL))
            .then((cached) => cached ?? new Response("Offline", { status: 503 })),
        ),
    );
    return;
  }

  // Only Vite build output (/assets/) and the precached files are cached. API
  // calls, authenticated images, and every other same-origin request go straight
  // to the network so user data is never stored.
  if (!url.pathname.startsWith("/assets/") && !urlsToCache.includes(url.pathname)) {
    return;
  }

  // Network-first for static assets. A saved shell references the chunks it
  // was loaded with, and a publish removes those from the server.
  // Hercules answers a missing file with the app's HTML (status 200), so treat
  // an HTML answer to a non-page request like a 404: never cache it, and fall
  // back to the cached copy when there is one.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response.ok || isHtml(response)) {
          return matchCached(event.request).then((cached) => cached ?? response);
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return response;
      })
      .catch(() =>
        matchCached(event.request).then(
          (cached) => cached ?? new Response("Offline", { status: 503 }),
        ),
      ),
  );
});

// Activate event - delete this worker's old versioned caches, never other caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith("app-assets-") && cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Every push must show a notification; Safari revokes the subscription after silent pushes
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};

  event.waitUntil(self.registration.showNotification(data.title, data.options));
});

// Handle notification clicks - opens/focuses the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing window if found
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      // Open new window if none exists
      if (clients.openWindow) return clients.openWindow("/");
    }),
  );
});
