const CACHE = "excursao-brasilia-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
// Keep authenticated and dynamic pages network-driven; never cache sensitive responses.
self.addEventListener("fetch", event => {
  if (event.request.mode === "navigate") return;
});
