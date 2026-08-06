/**
 * Bitig servis worker'ı.
 *
 * Tasarım kararları:
 *  - YALNIZCA statik uygulama kabuğu önbelleklenir. API yanıtları, Supabase
 *    ve GitHub istekleri ASLA önbelleğe alınmaz — kişisel veri diskte kalmasın
 *    ve bayat veri gösterilmesin diye.
 *  - Gezinme isteklerinde ağ önce denenir; çevrimdışıysa önbellekteki kabuk döner.
 *  - Sürüm değişince eski önbellekler silinir.
 */

const VERSION = "bitig-v1";
const SHELL_CACHE = `${VERSION}-shell`;

// Uygulama kabuğu: her sayfanın ihtiyaç duyduğu sabit varlıklar
const SHELL_ASSETS = [
  "/",
  "/manga",
  "/kalori",
  "/dizi-film",
  "/projeler",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Tek bir varlık başarısız olursa kurulum çökmesin
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Önbelleğe ALINMAYACAK istekler. */
function isExcluded(url) {
  if (url.origin !== self.location.origin) return true; // Supabase, GitHub, OpenRouter
  if (url.pathname.startsWith("/api/")) return true; // kişisel veri + AI yanıtları
  // Geliştirme artıkları (üretimde bulunmaz)
  if (url.pathname.startsWith("/_next/webpack-hmr")) return true;
  if (url.pathname.includes("hot-update")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isExcluded(url)) return; // tarayıcıya bırak, dokunma

  // Sayfa gezinmeleri: ağ önce, çevrimdışıysa önbellek
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match("/"))),
    );
    return;
  }

  // Statik varlıklar: önbellek önce, yoksa ağdan al ve sakla
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
