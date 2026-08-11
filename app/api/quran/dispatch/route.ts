import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { DEFAULT_EDITIONS, isKnownEdition, randomVerseRef } from "@/lib/quran/editions";
import { fetchVerse, VerseUnverifiedError, type VerifiedVerse } from "@/lib/quran/fetch";
import { env, webPushStatus } from "@/lib/env";
import { sendPush, type PushSubscriptionRecord } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
/** Cron her dakika çağırıyor; yanıt asla önbelleğe alınmamalı. */
export const dynamic = "force-dynamic";

type DueSlot = {
  slot_id: string;
  user_id: string;
  editions: string[];
  timezone: string;
  local_date: string;
};

/** Sabit süreli karşılaştırma — sırrı karakter karakter tahmin ettirmemek için. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Bildirim gövdesi tek satır; uzun meal kırpılır. */
function ozet(text: string, limit = 140): string {
  const tek = text.replace(/\s+/g, " ").trim();
  return tek.length <= limit ? tek : `${tek.slice(0, limit - 1)}…`;
}

/**
 * Yakında gönderilmemiş rastgele bir ayet bulup doğrular.
 *
 * İki ayrı sebeple yeniden deneniyor:
 *  1. Seçilen ayet son 60 gönderimde varsa — aynı ayetin sık tekrarı
 *     bildirimi değersizleştirir.
 *  2. Ayet doğrulanamadıysa — kaynaklar çelişti ya da yanıt vermedi.
 *     Bu durumda BAŞKA bir ayet denenir; doğrulanamayan ayet asla
 *     gönderilmez.
 *
 * Deneme sayısı sınırlı: Netlify çağrıyı 10 saniyede kesiyor ve her deneme
 * ölçülen ortancaya göre ~1 saniye sürüyor.
 */
async function ayetSec(
  yakinlar: Set<string>,
  editions: string[],
  signal: AbortSignal | undefined,
  denemeSiniri = 4,
): Promise<{ verse: VerifiedVerse } | { hata: string }> {
  let sonHata = "ayet bulunamadı";

  for (let deneme = 0; deneme < denemeSiniri; deneme += 1) {
    const ref = randomVerseRef();
    if (yakinlar.has(`${ref.surah}:${ref.ayah}`)) continue;

    try {
      return { verse: await fetchVerse(ref, editions, signal) };
    } catch (error) {
      if (!(error instanceof VerseUnverifiedError)) throw error;
      sonHata = error.message;
    }
  }

  return { hata: sonHata };
}

/**
 * Zamanı gelen ayet bildirimlerini gönderir.
 *
 * Not hatırlatmalarından AYRI bir uç: ayet çekimi dış kaynaklara gidip
 * çapraz doğrulama yapıyor ve saniyeler sürebiliyor. Aynı çağrıya konsaydı
 * yavaş bir ayet, hatırlatmaları da 10 saniyelik sınıra takıp düşürebilirdi.
 */
export async function POST(request: Request) {
  const expected = env.reminderDispatchSecret();
  if (!expected) {
    return NextResponse.json({ error: "Yapılandırılmamış." }, { status: 503 });
  }
  if (!secretMatches(request.headers.get("x-dispatch-secret") ?? "", expected)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (!webPushStatus().configured) {
    return NextResponse.json({ error: "VAPID yapılandırılmamış." }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 503 });
  }

  const { data: due, error } = await admin.rpc("due_quran_slots");
  if (error) {
    return NextResponse.json({ error: "Saatler okunamadı." }, { status: 500 });
  }

  const slotlar = (due ?? []) as DueSlot[];
  if (slotlar.length === 0) {
    return NextResponse.json({ slots: 0, sent: 0 });
  }

  const userIds = [...new Set(slotlar.map((s) => s.user_id))];

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const cihazlar = new Map<string, PushSubscriptionRecord[]>();
  for (const sub of (subs ?? []) as (PushSubscriptionRecord & { user_id: string })[]) {
    const liste = cihazlar.get(sub.user_id) ?? [];
    liste.push(sub);
    cihazlar.set(sub.user_id, liste);
  }

  // Son gönderilenler — tekrarı önlemek için
  const { data: gecmis } = await admin
    .from("quran_deliveries")
    .select("user_id, surah, ayah")
    .in("user_id", userIds)
    .order("sent_at", { ascending: false })
    .limit(60 * userIds.length);

  const yakinlar = new Map<string, Set<string>>();
  for (const k of (gecmis ?? []) as { user_id: string; surah: number; ayah: number }[]) {
    const kume = yakinlar.get(k.user_id) ?? new Set<string>();
    kume.add(`${k.surah}:${k.ayah}`);
    yakinlar.set(k.user_id, kume);
  }

  let sent = 0;
  let dogrulanamayan = 0;
  const olenler: string[] = [];
  const isaretlenecek: { id: string; local_date: string }[] = [];

  for (const slot of slotlar) {
    const cihaz = cihazlar.get(slot.user_id) ?? [];
    /*
     * Cihaz yoksa ayet ÇEKİLMİYOR ve slot işaretlenmiyor: boşuna dış
     * kaynaklara gitmenin anlamı yok, ayrıca kullanıcı gün içinde bildirime
     * izin verirse o günün ayeti hâlâ gidebilsin.
     */
    if (cihaz.length === 0) continue;

    const secilen = (slot.editions ?? []).filter(isKnownEdition);
    const editions = secilen.length > 0 ? secilen : [...DEFAULT_EDITIONS];

    const sonuc = await ayetSec(
      yakinlar.get(slot.user_id) ?? new Set(),
      editions,
      request.signal,
    );

    if ("hata" in sonuc) {
      /*
       * Doğrulanamadıysa slot İŞARETLENMİYOR. Cron dakikada bir çalışıyor ve
       * `due_quran_slots` 10 dakikalık pencere veriyor; kaynak geçici olarak
       * erişilemezse bir sonraki turda yeniden denenir. Doğrulanmamış ayet
       * göndermektense geç göndermek yeğdir.
       */
      dogrulanamayan += 1;
      continue;
    }

    const { verse } = sonuc;

    // Önce kaydet: bildirime tıklandığında gösterilecek kayıt hazır olmalı
    const { data: kayit, error: kayitHatasi } = await admin
      .from("quran_deliveries")
      .insert({
        user_id: slot.user_id,
        surah: verse.surah,
        ayah: verse.ayah,
        surah_name: verse.surahName,
        surah_name_latin: verse.surahNameLatin,
        arabic: verse.arabic,
        translations: verse.translations,
        arabic_sources: verse.arabicSources,
      })
      .select("id")
      .single();

    if (kayitHatasi || !kayit) continue;

    const ilkMeal = verse.translations[0];
    let basarili = false;
    for (const hedef of cihaz) {
      const outcome = await sendPush(hedef, {
        title: `${verse.surahNameLatin} ${verse.surah}:${verse.ayah}`,
        body: ozet(ilkMeal.text),
        url: `/kuran?ayet=${kayit.id}`,
        // Aynı ayetin bildirimi üst üste yığılmasın
        tag: `ayet-${kayit.id}`,
      });
      if (outcome.ok) {
        basarili = true;
        sent += 1;
      } else if (outcome.expired) {
        olenler.push(hedef.id);
      }
    }

    if (basarili) {
      isaretlenecek.push({ id: slot.slot_id, local_date: slot.local_date });
      const kume = yakinlar.get(slot.user_id) ?? new Set<string>();
      kume.add(`${verse.surah}:${verse.ayah}`);
      yakinlar.set(slot.user_id, kume);
    } else {
      /*
       * Hiçbir cihaza ulaşılamadıysa kayıt geri alınıyor: aksi hâlde
       * gönderilmemiş bir ayet geçmişte durur, tekrar seçilmesini engeller
       * ve kullanıcı hiç görmediği bir ayeti "gönderilmiş" sanır.
       */
      await admin.from("quran_deliveries").delete().eq("id", kayit.id);
    }
  }

  if (olenler.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", olenler);
  }

  for (const item of isaretlenecek) {
    await admin.from("quran_slots").update({ last_sent_on: item.local_date }).eq("id", item.id);
  }

  return NextResponse.json({
    slots: slotlar.length,
    sent,
    unverified: dogrulanamayan,
    removedSubscriptions: olenler.length,
  });
}
