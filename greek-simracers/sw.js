// Service worker — κάνει το site εγκαταστάσιμο και του δίνει offline
// εναλλακτική. Κρατάμε τους κανόνες αυστηρούς επίτηδες:
//
//   * μόνο same-origin GET μπαίνει στην cache — ποτέ κλήσεις στο Supabase
//     (έχουν tokens και αλλάζουν συνέχεια),
//   * τα HTML πάνε πρώτα στο δίκτυο ώστε να μη μένει κανείς με παλιά
//     σελίδα, με fallback στην cache και μετά στο offline.html,
//   * τα assets πάνε πρώτα στην cache γιατί έχουν σταθερό περιεχόμενο.
//
// Ανεβάζοντας το CACHE_VERSION καθαρίζονται αυτόματα οι παλιές caches.

const CACHE_VERSION = "gsr-v2";
const PRECACHE = [
  "./",
  "./index.html",
  "./offline.html",
  "./assets/css/tokens.css",
  "./assets/css/base.css",
  "./assets/css/components.css",
  "./assets/css/motion.css",
  "./assets/css/hub.css",
  "./game.html",
  "./assets/css/game.css",
  "./assets/js/main.js",
  "./assets/images/gsr-logo.png",
  "./assets/images/icon-192.png",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // Ένα αρχείο που λείπει δεν πρέπει να ρίξει όλη την εγκατάσταση.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHtmlRequest(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, CDN, Spotify: πάντα δίκτυο

  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("./offline.html"))
        )
    );
    return;
  }

  // Assets: απαντάμε αμέσως από την cache αλλά ζητάμε και το φρέσκο στο
  // παρασκήνιο (stale-while-revalidate). Χωρίς αυτό, ένα CSS με το ίδιο
  // όνομα θα έμενε παγωμένο μέχρι να αλλάξει το CACHE_VERSION.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
