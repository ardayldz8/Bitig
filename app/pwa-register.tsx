"use client";

import { useEffect } from "react";

/** Service worker'ı kaydeder (çevrimdışı çalışma + ana ekrana ekleme). */
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // kayıt başarısız olsa da uygulama çalışmaya devam eder
      });
    }
  }, []);
  return null;
}
