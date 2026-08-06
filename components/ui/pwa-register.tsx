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
