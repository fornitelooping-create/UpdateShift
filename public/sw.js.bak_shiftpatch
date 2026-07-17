// Service worker minimal pour rendre Shift installable sur mobile
// (Android/Chrome exige un service worker actif pour proposer
// "Ajouter à l'écran d'accueil"). On ne met en cache que le strict
// nécessaire pour ne pas risquer de servir une version périmée de
// l'app — le vrai contrôle de version reste géré par useAppUpdateCheck.

const CACHE_NAME = "shift-shell-v1";
const APP_SHELL = ["/", "/manifest.json", "/shift-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stratégie "network first" : on va toujours chercher la dernière version
// en ligne d'abord, et on ne retombe sur le cache que si le réseau est
// indisponible (mode hors-ligne). Ça évite de bloquer les utilisateurs sur
// une vieille version de l'app comme le ferait un cache "cache first".
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
