import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { latestChapterOf } from "@/lib/catalog/manga-search";
import { env } from "@/lib/env";
import { sendPush, type PushSubscriptionRecord } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** MangaDex'e saniyede 5 istekten fazlası hız sınırına takılıyor. */
const ISTEKLER_ARASI_MS = 250;

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const bekle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Satir = {
  id: string;
  user_id: string;
  name: string;
  current_chapter: number;
  mangadex_id: string;
  latest_chapter: number | null;
  notified_chapter: number | null;
};

/**
 * Bağlı mangaların yeni bölümlerini kontrol eder ve bildirir.
 *
 * Günde bir çalışıyor: manga bölümleri haftalık yayımlanıyor, saatlik
 * kontrol hem gereksiz hem MangaDex'e karşı kaba olurdu.
 */
export async function POST(request: Request) {
  const expected = env.reminderDispatchSecret();
  if (!expected) {
    return NextResponse.json({ error: "Yapılandırılmamış." }, { status: 503 });
  }
  if (!secretMatches(request.headers.get("x-dispatch-secret") ?? "", expected)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 503 });
  }

  const { data } = await admin
    .from("mangas")
    .select("id, user_id, name, current_chapter, mangadex_id, latest_chapter, notified_chapter")
    .not("mangadex_id", "is", null)
    // Bitirilen manga takip edilmiyor
    .neq("status", "completed");

  const mangalar = (data ?? []) as Satir[];
  if (mangalar.length === 0) {
    return NextResponse.json({ checked: 0, notified: 0 });
  }

  /** Kullanıcı başına yeni bölüm çıkan mangalar. */
  const bildirilecek = new Map<string, { name: string; yeni: number; son: number }[]>();
  let kontrol = 0;

  for (const manga of mangalar) {
    const son = await latestChapterOf(manga.mangadex_id, request.signal);
    kontrol++;
    await bekle(ISTEKLER_ARASI_MS);

    if (son === null) continue;

    // Katalogdaki son bölüm her hâlükârda güncelleniyor (arayüz bunu gösteriyor)
    if (son !== manga.latest_chapter) {
      await admin
        .from("mangas")
        .update({ latest_chapter: son, latest_checked_at: new Date().toISOString() })
        .eq("id", manga.id);
    }

    const okunmamis = son - manga.current_chapter;
    if (okunmamis <= 0) continue;

    /*
     * Aynı bölüm için tekrar bildirim gönderilmiyor. Bu olmadan kullanıcı
     * mangayı okumadığı sürece HER GÜN aynı bildirimi alırdı — bildirimleri
     * kapatmasının en hızlı yolu.
     */
    if (manga.notified_chapter !== null && son <= manga.notified_chapter) continue;

    const liste = bildirilecek.get(manga.user_id) ?? [];
    liste.push({ name: manga.name, yeni: Math.floor(okunmamis), son });
    bildirilecek.set(manga.user_id, liste);
  }

  let gonderilen = 0;

  for (const [userId, liste] of bildirilecek) {
    const { data: cihazlar } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    const hedefler = (cihazlar ?? []) as PushSubscriptionRecord[];
    if (hedefler.length === 0) continue;

    /*
     * Manga başına ayrı bildirim yerine TEK bildirim: beş mangada yeni bölüm
     * çıktığında telefona beş ayrı bildirim düşürmek, faydalı olanı da
     * gürültüye çeviriyor.
     */
    const baslik =
      liste.length === 1
        ? `${liste[0].name} — ${liste[0].yeni} yeni bölüm`
        : `${liste.length} mangada yeni bölüm`;

    const govde =
      liste.length === 1
        ? `${liste[0].son}. bölüme kadar çıktı`
        : liste
            .slice(0, 4)
            .map((item) => `${item.name} (+${item.yeni})`)
            .join(", ") + (liste.length > 4 ? ` ve ${liste.length - 4} tane daha` : "");

    const olenler: string[] = [];
    let basarili = false;

    for (const hedef of hedefler) {
      const sonuc = await sendPush(hedef, {
        title: baslik,
        body: govde,
        url: "/manga",
        tag: "manga-yeni-bolum",
      });
      if (sonuc.ok) {
        basarili = true;
        gonderilen++;
      } else if (sonuc.expired) {
        olenler.push(hedef.id);
      }
    }

    if (olenler.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", olenler);
    }

    /*
     * notified_chapter yalnızca bildirim GERÇEKTEN gittiyse yazılıyor.
     * Gönderim başarısızken işaretlenseydi o bölüm için bir daha haber
     * verilmezdi.
     */
    if (basarili) {
      for (const item of liste) {
        await admin
          .from("mangas")
          .update({ notified_chapter: item.son })
          .eq("user_id", userId)
          .eq("name", item.name);
      }
    }
  }

  return NextResponse.json({ checked: kontrol, notified: gonderilen });
}
