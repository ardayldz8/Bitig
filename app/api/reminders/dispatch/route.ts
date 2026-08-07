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

  const { data: due, error } = await admin.rpc("due_reminders");
  if (error) {
    return NextResponse.json({ error: "Hatırlatmalar okunamadı." }, { status: 500 });
  }

  const reminders = (due ?? []) as DueReminder[];
  if (reminders.length === 0) {
    return NextResponse.json({ sent: 0, reminders: 0 });
  }

  // İlgili kullanıcıların abonelikleri tek sorguda
  const userIds = [...new Set(reminders.map((item) => item.user_id))];
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
   * Yalnızca EN AZ BİR cihaza ulaşan hatırlatmalar "gönderildi" sayılır.
   * Hepsi başarısızsa last_sent_on yazılmaz; bir sonraki turda (10 dakikalık
   * pencere içinde) yeniden denenir. Aksi hâlde geçici bir ağ hatası, o günün
   * hatırlatmasını tamamen düşürürdü.
   */
  const gonderilen: Array<{ id: string; local_date: string }> = [];

  for (const reminder of reminders) {
    const targets = byUser.get(reminder.user_id) ?? [];
    if (targets.length === 0) continue;

    const payload = {
      title: reminder.title.trim() || "Hatırlatma",
      body: ozet(reminder.body) || "Notuna göz at",
      url: `/notlar?not=${reminder.note_id}`,
      // Aynı notun bildirimi üst üste yığılmasın
      tag: `not-${reminder.note_id}`,
    };

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

    if (basarili) {
      gonderilen.push({ id: reminder.reminder_id, local_date: reminder.local_date });
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

  return NextResponse.json({
    reminders: reminders.length,
    sent,
    removedSubscriptions: olenAbonelikler.length,
  });
}
