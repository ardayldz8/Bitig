import { supabase } from "./supabase";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export function notificationsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** Şu an bu cihazda bildirim aboneliği aktif mi? */
export async function notificationsEnabled(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/** İzin ister, push aboneliği oluşturur ve Supabase'e kaydeder. */
export async function enableNotifications(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!notificationsSupported())
    return { ok: false, error: "Bu cihaz/tarayıcı bildirimleri desteklemiyor." };
  if (!VAPID_PUBLIC) return { ok: false, error: "VAPID public anahtarı tanımlı değil (.env.local)." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, error: "Bildirim izni verilmedi." };

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC),
      });
    }
    const json = sub.toJSON() as { endpoint?: string };
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { user_id: userId, endpoint: json.endpoint, subscription: json },
        { onConflict: "endpoint" }
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Abonelik kurulamadı." };
  }
}

/** Aboneliği iptal eder ve Supabase'den siler. */
export async function disableNotifications(): Promise<void> {
  if (!notificationsSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    }
  } catch {
    // yoksay
  }
}
