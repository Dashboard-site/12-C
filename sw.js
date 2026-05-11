const CACHE_NAME = "class12c-dashboard-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.png",
  "./logo.png",
  "./bg1.png",
  "./bg2.png",
  "./bg3.png",
  "./bg4.png",
  "./bg5.png",
  "./bg6.png",
  "./bg7.png",
  "./bg8.png",
  "./bg9.png",
  "./bg10.png",
  "./Ndot_font.woff2"  // worth adding this too
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});
