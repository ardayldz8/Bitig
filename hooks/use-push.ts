"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Bildirim aboneliğinin durumu.
 *
 * `ios_needs_install` ayrı bir durum: iOS'ta Web Push YALNIZCA uygulama ana
 * ekrana eklendiğinde çalışıyor (iOS 16.4+). Safari sekmesinde izin istemek
 * sessizce başarısız oluyor; kullanıcıya "izin ver" düğmesi göstermek yerine
 * ne yapması gerektiğini anlatmak lazım.
 */
export type PushDurum =
  | "yukleniyor"
  | "desteklenmiyor"
  | "ios_needs_install"
  | "kapali"
  | "reddedildi"
  | "acik";

export type PushControl = {
  durum: PushDurum;
  hata: string | null;
  mesgul: boolean;
  ac: () => Promise<void>;
  kapat: () => Promise<void>;
};

/** VAPID açık anahtarı base64url string; subscribe() Uint8Array istiyor. */
function base64UrlToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const normal = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normal);
  // new Uint8Array(number) tipi ArrayBufferLike üretiyor; applicationServerKey
  // BufferSource istiyor ve SharedArrayBuffer'ı kabul etmiyor.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ masaüstü Safari gibi davranıyor; dokunma desteğiyle ayırt edilir
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function anaEkrandaMi(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari'nin kendi bayrağı; standart display-mode'u desteklemiyor
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Oturum jetonuyla API çağrısı — abonelik kullanıcıya bağlanmalı. */
async function authedFetch(path: string, body: unknown, method = "POST") {
  const client = getBrowserClient();
  if (!client) throw new Error("Supabase yapılandırılmamış.");

  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Oturum bulunamadı.");

  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "İstek başarısız.");
  }
}

export function usePush(vapidPublicKey: string): PushControl {
  const [durum, setDurum] = useState<PushDurum>("yukleniyor");
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const tazele = useCallback(async () => {
    if (typeof window === "undefined") return;

    const destek =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    if (!destek) {
      // iOS'ta ana ekrana eklenmemişse PushManager hiç tanımlı olmuyor
      setDurum(isIos() && !anaEkrandaMi() ? "ios_needs_install" : "desteklenmiyor");
      return;
    }

    if (Notification.permission === "denied") {
      setDurum("reddedildi");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setDurum(subscription ? "acik" : "kapali");
  }, []);

  useEffect(() => {
    void tazele();
  }, [tazele]);

  const ac = useCallback(async () => {
    setHata(null);
    setMesgul(true);
    try {
      if (!vapidPublicKey) {
        throw new Error("Bildirim anahtarı yapılandırılmamış.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDurum(permission === "denied" ? "reddedildi" : "kapali");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      /*
       * Zaten bir abonelik varsa yenisini oluşturmuyoruz: applicationServerKey
       * değişmediği sürece aynı endpoint döner, ama gereksiz subscribe çağrısı
       * bazı tarayıcılarda eskisini iptal edip yeni endpoint üretiyor ve
       * sunucuda ölü kayıt bırakıyor.
       */
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
        }));

      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error("Abonelik bilgisi eksik döndü.");
      }

      await authedFetch("/api/push/subscribe", {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });

      setDurum("acik");
    } catch (error) {
      setHata(error instanceof Error ? error.message : "Bildirimler açılamadı.");
    } finally {
      setMesgul(false);
    }
  }, [vapidPublicKey]);

  const kapat = useCallback(async () => {
    setHata(null);
    setMesgul(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Önce sunucudan sil: unsubscribe() sonrası endpoint elimizde kalmaz
        // ve sunucuda ölü kayıt kalıcı olurdu.
        await authedFetch(
          "/api/push/subscribe",
          { endpoint: subscription.endpoint },
          "DELETE",
        ).catch(() => undefined);
        await subscription.unsubscribe();
      }

      setDurum("kapali");
    } catch (error) {
      setHata(error instanceof Error ? error.message : "Bildirimler kapatılamadı.");
    } finally {
      setMesgul(false);
    }
  }, []);

  return { durum, hata, mesgul, ac, kapat };
}
