import webpush from "web-push";
import { env, webPushStatus } from "@/lib/env";

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

let yapilandirildi = false;

function hazirla(): boolean {
  if (!webPushStatus().configured) return false;
  if (yapilandirildi) return true;

  webpush.setVapidDetails(
    env.vapidSubject(),
    env.vapidPublicKey(),
    env.vapidPrivateKey(),
  );
  yapilandirildi = true;
  return true;
}

/**
 * Tek bir gönderimin sonucu.
 *
 * `expired`, aboneliğin kalıcı olarak geçersiz olduğunu söyler (kullanıcı
 * bildirimleri kapattı ya da tarayıcı verisini sildi). Bu satır silinmeli;
 * aksi hâlde her dakika ölü bir uca istek atılır.
 */
export type SendOutcome =
  | { ok: true }
  | { ok: false; expired: boolean; status: number | null; message: string };

export async function sendPush(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<SendOutcome> {
  if (!hazirla()) {
    return { ok: false, expired: false, status: null, message: "VAPID yapılandırılmamış" };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      // Kullanıcı çevrimdışıysa push servisi bu süre kadar tutar. Bir
      // hatırlatmanın 6 saat sonra düşmesi anlamsız olurdu.
      { TTL: 3600 },
    );
    return { ok: true };
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : null;

    /*
     * 404/410: abonelik artık yok — push servisinin kesin cevabı.
     * Diğer hatalar (429, 5xx, ağ) geçici; abonelik silinmemeli, yoksa
     * servisin geçici arızası kullanıcının bildirimlerini kalıcı kapatırdı.
     */
    const expired = status === 404 || status === 410;

    return {
      ok: false,
      expired,
      status,
      message: error instanceof Error ? error.message : "bilinmeyen hata",
    };
  }
}
