/**
 * Deliberately cache-free service worker.
 *
 * It exists for one reason: Chrome on Android will not offer to install a web
 * app unless a service worker with a fetch handler is registered. Without it
 * you get a plain bookmark instead of a real installed app.
 *
 * It caches NOTHING on purpose. An offline shell would mean versioning a cache
 * and risking a stale build being served after a deploy — a much worse failure
 * than "the app needs a connection", which is true of a chat client anyway.
 *
 * Only navigations are intercepted, and only to pass them straight through.
 * Everything else (crucially the streaming /api/chat response) is left alone:
 * not calling respondWith() means the browser handles the request exactly as
 * it would with no service worker at all.
 */

self.addEventListener("install", () => {
  // Take over immediately rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean up any cache a previous version of this file may have left.
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
  }
});
