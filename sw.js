/* Freaks & Geeks rater — service worker (offline-first, cache everything on install) */
var CACHE = "fng-rater-v2";

var ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "data.js",
  "app.js",
  "manifest.webmanifest",
  "assets/icon.svg",
  "assets/icon-180.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/stills/01-pilot.jpg",
  "assets/stills/02-beers-and-weirs.jpg",
  "assets/stills/03-tricks-and-treats.jpg",
  "assets/stills/04-kim-kelly-is-my-friend.jpg",
  "assets/stills/05-tests-and-breasts.jpg",
  "assets/stills/06-im-with-the-band.jpg",
  "assets/stills/07-carded-and-discarded.jpg",
  "assets/stills/08-girlfriends-and-boyfriends.jpg",
  "assets/stills/09-weve-got-spirit.jpg",
  "assets/stills/10-the-diary.jpg",
  "assets/stills/11-looks-and-books.jpg",
  "assets/stills/12-the-garage-door.jpg",
  "assets/stills/13-chokin-and-tokin.jpg",
  "assets/stills/14-dead-dogs-and-gym-teachers.jpg",
  "assets/stills/15-noshing-and-moshing.jpg",
  "assets/stills/16-smooching-and-mooching.jpg",
  "assets/stills/17-the-little-things.jpg",
  "assets/stills/18-discos-and-dragons.jpg",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== CACHE) return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Cache-first for our own assets; fall back to network, then cache the result.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request)
        .then(function (resp) {
          if (resp && resp.status === 200 && (resp.type === "basic" || resp.type === "cors")) {
            var copy = resp.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          }
          return resp;
        })
        .catch(function () {
          // Offline and not cached: for navigations, serve the app shell.
          if (e.request.mode === "navigate") return caches.match("index.html");
        });
    })
  );
});
