"use client";

import { useEffect } from "react";

/**
 * Servis worker'ı kaydeder.
 * Kayıt başarısız olsa da uygulama normal çalışmaya devam eder;
 * PWA yalnızca bir iyileştirmedir, çalışma şartı değildir.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Geliştirmede kayıt YAPILMAZ: worker uygulama kabuğunu önbelleğe aldığı
    // için kod değişince eski HTML sunuluyor ve hidrasyon uyuşmazlığı çıkıyor.
    // Daha önce kaydedilmiş bir worker varsa temizlenir.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      void caches?.keys().then((keys) => {
        for (const key of keys) if (key.startsWith("bitig-")) void caches.delete(key);
      });
      return;
    }

    // Sayfa yüklendikten sonra kaydet — ilk boyamayı geciktirmesin
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Kayıt başarısız (ör. güvensiz köken) — sessizce geç
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
