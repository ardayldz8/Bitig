import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env, webPushStatus } from "@/lib/env";
import { sendPush, type PushSubscriptionRecord } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
/** Cron her dakika çağırıyor; yanıt asla önbelleğe alınmamalı. */
export const dynamic = "force-dynamic";

type DueReminder = {
  reminder_id: string;
  user_id: string;
  note_id: string;
  title: string;
  body: string;
  local_date: string;
};

/** Sabit süreli karşılaştırma — sırrı karakter karakter tahmin ettirmemek için. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type DueSubscription = {
  subscription_id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: string;
  due_on: string;
  days_before: number;
};

/** "7 gün kala" / "yarın" gibi insan diline yakın ifade. */
function kalanMetni(gun: number): string {
  if (gun === 1) return "yarın";
  return `${gun} gün sonra`;
}

function tutar(amount: number, currency: string): string {
  const simge = currency === "TRY" ? "₺" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  const sayi = Number(amount).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return simge ? `${sayi} ${simge}` : `${sayi} ${currency}`;
}

/** Bildirim gövdesi: uzun not tek satıra sığmaz, kırpılır. */
function ozet(text: string, limit = 120): string {
  const tek = text.replace(/\s+/g, " ").trim();
  return tek.length <= limit ? tek : `${tek.slice(0, limit - 1)}…`;
}

/**
 * Zamanı gelen hatırlatmaları gönderir.
 *
 * pg_cron dakikada bir çağırıyor. Kimlik doğrulaması paylaşılan sırla:
 * bu uç bir kullanıcı oturumuyla değil, veritabanından tetikleniyor.
 */
export async function POST(request: Request) {
  const expected = env.reminderDispatchSecret();
  if (!expected) {
    return NextResponse.json({ error: "Yapılandırılmamış." }, { status: 503 });
  }

  const provided = request.headers.get("x-dispatch-secret") ?? "";
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  if (!webPushStatus().configured) {
    return NextResponse.json({ error: "VAPID yapılandırılmamış." }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 503 });
  }

  /*
   * İKİ kaynak birlikte işleniyor: not hatırlatmaları ve abonelik ödemeleri.
   *
   * Önce yalnızca hatırlatmalar okunup boşsa erken dönülüyordu; o gün not
   * hatırlatması olmayan bir kullanıcıya abonelik bildirimi HİÇ gitmezdi.
   */
  const { data: due, error } = await admin.rpc("due_reminders");
  if (error) {
    return NextResponse.json({ error: "Hatırlatmalar okunamadı." }, { status: 500 });
  }
  const reminders = (due ?? []) as DueReminder[];

  const { data: dueSubs } = await admin.rpc("due_subscription_notices");
  const abonelikler = (dueSubs ?? []) as DueSubscription[];

  if (reminders.length === 0 && abonelikler.length === 0) {
    return NextResponse.json({ reminders: 0, subscriptions: 0, sent: 0 });
  }

  // Her iki kaynaktaki kullanıcıların cihazları tek sorguda
  const userIds = [
    ...new Set([
      ...reminders.map((item) => item.user_id),
      ...abonelikler.map((item) => item.user_id),
    ]),
  ];
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const byUser = new Map<string, PushSubscriptionRecord[]>();
  for (const sub of (subs ?? []) as (PushSubscriptionRecord & { user_id: string })[]) {
    const list = byUser.get(sub.user_id) ?? [];
    list.push(sub);
    byUser.set(sub.user_id, list);
  }

  let sent = 0;
  const olenAbonelikler: string[] = [];
  /*
   * Yalnızca EN AZ BİR cihaza ulaşanlar "gönderildi" sayılır. Hepsi
   * başarısızsa işaretlenmez ve bir sonraki turda yeniden denenir; aksi hâlde
   * geçici bir ağ hatası o günün bildirimini tamamen düşürürdü.
   */
  const gonderilen: Array<{ id: string; local_date: string }> = [];

  const gonder = async (
    userId: string,
    payload: { title: string; body: string; url: string; tag: string },
  ): Promise<boolean> => {
    const targets = byUser.get(userId) ?? [];
    let basarili = false;
    for (const target of targets) {
      const outcome = await sendPush(target, payload);
      if (outcome.ok) {
        basarili = true;
        sent++;
      } else if (outcome.expired) {
        olenAbonelikler.push(target.id);
      }
    }
    return basarili;
  };

  // ------------------------------------------------- Not hatırlatmaları

  for (const reminder of reminders) {
    const basarili = await gonder(reminder.user_id, {
      title: reminder.title.trim() || "Hatırlatma",
      body: ozet(reminder.body) || "Notuna göz at",
      url: `/notlar?not=${reminder.note_id}`,
      // Aynı notun bildirimi üst üste yığılmasın
      tag: `not-${reminder.note_id}`,
    });

    if (basarili) {
      gonderilen.push({ id: reminder.reminder_id, local_date: reminder.local_date });
    }
  }

  // --------------------------------------------------- Abonelik ödemeleri

  const yazilacakBildirimler: Array<{
    subscription_id: string;
    user_id: string;
    due_on: string;
    days_before: number;
  }> = [];

  for (const abonelik of abonelikler) {
    const basarili = await gonder(abonelik.user_id, {
      title: `${abonelik.name} ödemesi ${kalanMetni(abonelik.days_before)}`,
      body: `${tutar(abonelik.amount, abonelik.currency)} · ${abonelik.due_on}`,
      url: "/abonelikler",
      /*
       * Eşik tag'e dahil: 7, 3 ve 1 gün bildirimleri BİRBİRİNİ EZMEMELİ.
       * Yalnızca abonelik id'si kullanılsaydı üçüncü bildirim ilk ikisinin
       * yerine geçer ve kullanıcı önceki uyarıları hiç görmemiş olurdu.
       */
      tag: `abonelik-${abonelik.subscription_id}-${abonelik.days_before}`,
    });

    if (basarili) {
      yazilacakBildirimler.push({
        subscription_id: abonelik.subscription_id,
        user_id: abonelik.user_id,
        due_on: abonelik.due_on,
        days_before: abonelik.days_before,
      });
    }
  }

  // Ölü abonelikler temizlenmezse her dakika boşuna istek atılır
  if (olenAbonelikler.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", olenAbonelikler);
  }

  for (const item of gonderilen) {
    await admin
      .from("note_reminders")
      .update({ last_sent_on: item.local_date })
      .eq("id", item.id);
  }

  if (yazilacakBildirimler.length > 0) {
    await admin.from("subscription_notices").insert(yazilacakBildirimler);
  }

  return NextResponse.json({
    reminders: reminders.length,
    subscriptions: abonelikler.length,
    sent,
    removedSubscriptions: olenAbonelikler.length,
  });
}
