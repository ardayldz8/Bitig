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

// Sürüm artırıldı: yeni push işleyicileri eski worker'da yok, eski sürüm
// takılı kalırsa bildirimler hiç gelmez.
const VERSION = "bitig-v4";
const SHELL_CACHE = `${VERSION}-shell`;

// Uygulama kabuğu: her sayfanın ihtiyaç duyduğu sabit varlıklar
const SHELL_ASSETS = [
  "/",
  "/manga",
  "/kalori",
  "/dizi-film",
  "/repolar",
  "/notlar",
  "/abonelikler",
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

/* ------------------------------------------------------------ Bildirimler */

/**
 * Sunucudan gelen push mesajı.
 *
 * Gövde her zaman JSON: { title, body, url, tag }. Bozuk ya da boş bir gövde
 * gelirse bildirim yine de gösteriliyor — showNotification çağrılmazsa bazı
 * tarayıcılar "bu site arka planda güncellendi" diye kendi genel bildirimini
 * gösteriyor, o da kullanıcıya anlamsız geliyor.
 */
self.addEventListener("push", (event) => {
  let veri = {};
  try {
    veri = event.data ? event.data.json() : {};
  } catch {
    veri = {};
  }

  const baslik = veri.title || "Bitig";
  const secenekler = {
    body: veri.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Aynı tag'li bildirim üst üste yığılmaz, sonuncusu öncekini değiştirir
    tag: veri.tag || "bitig-hatirlatma",
    // Titreşim, telefon sessizdeyken bile fark edilmesini sağlıyor
    vibrate: [120, 60, 120],
    data: { url: veri.url || "/notlar" },
  };

  event.waitUntil(self.registration.showNotification(baslik, secenekler));
});

/** Bildirime dokunulunca: açık sekme varsa ona odaklan, yoksa yenisini aç. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const hedef = (event.notification.data && event.notification.data.url) || "/notlar";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Zaten açık bir Bitig sekmesi varsa yenisini açmak yerine oraya git
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(hedef);
          return client.focus();
        }
      }
      return self.clients.openWindow(hedef);
    }),
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
