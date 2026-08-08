import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendPush, type PushSubscriptionRecord } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type Satir = {
  user_id: string;
  full_name: string;
  pushed_at: string | null;
  open_prs: number;
  ci_conclusion: string | null;
};

/**
 * Haftalık repo özeti.
 *
 * Tek bir bildirim: bu hafta neye dokunuldu, ne bekliyor. Amaç 37 repoyu
 * haftada bir gözden geçirtmek — envanterin işe yaraması için düzenli
 * bakılması gerekiyor ve uygulamayı açmayı hatırlamak zor.
 *
 * Karar verilmiş repolar sayılmıyor: "bitti" ve "çöp" dedikleriniz her hafta
 * yeniden gündeme gelirse triyajın anlamı kalmaz.
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

  const { data: repolar } = await admin
    .from("repo_snapshots")
    .select("user_id, full_name, pushed_at, open_prs, ci_conclusion");

  const { data: kararlar } = await admin
    .from("repo_triage")
    .select("user_id, full_name, decision");

  const kapali = new Set(
    (kararlar ?? [])
      .filter((k) => k.decision === "done" || k.decision === "junk")
      .map((k) => `${k.user_id}|${k.full_name}`),
  );

  // Kullanıcı başına topla
  const kullaniciBasi = new Map<
    string,
    { dokunulan: number; acikPr: number; kirikCi: string[]; bayatKararsiz: number }
  >();

  const simdi = Date.now();
  const HAFTA = 7 * 86_400_000;

  for (const satir of (repolar ?? []) as Satir[]) {
    if (kapali.has(`${satir.user_id}|${satir.full_name}`)) continue;

    const kayit =
      kullaniciBasi.get(satir.user_id) ??
      { dokunulan: 0, acikPr: 0, kirikCi: [] as string[], bayatKararsiz: 0 };

    const yas = satir.pushed_at ? simdi - new Date(satir.pushed_at).getTime() : null;

    if (yas !== null && yas <= HAFTA) kayit.dokunulan++;
    kayit.acikPr += satir.open_prs ?? 0;

    // Kırık CI yalnızca canlı repolarda anlamlı
    if (satir.ci_conclusion === "failure" && yas !== null && yas <= 90 * 86_400_000) {
      kayit.kirikCi.push(satir.full_name);
    }

    const kararVerilmis = (kararlar ?? []).some(
      (k) => k.user_id === satir.user_id && k.full_name === satir.full_name,
    );
    if ((yas === null || yas > 90 * 86_400_000) && !kararVerilmis) kayit.bayatKararsiz++;

    kullaniciBasi.set(satir.user_id, kayit);
  }

  let gonderilen = 0;

  for (const [userId, ozet] of kullaniciBasi) {
    /*
     * Söylenecek bir şey yoksa bildirim gönderilmiyor. Her pazar "hiçbir şey
     * olmadı" demek, bildirimlerin görmezden gelinmesini öğretir.
     */
    const soylenecek =
      ozet.dokunulan > 0 || ozet.acikPr > 0 || ozet.kirikCi.length > 0 || ozet.bayatKararsiz > 0;
    if (!soylenecek) continue;

    const parcalar: string[] = [];
    if (ozet.dokunulan > 0) parcalar.push(`${ozet.dokunulan} repoya dokundun`);
    if (ozet.acikPr > 0) parcalar.push(`${ozet.acikPr} PR açık`);
    if (ozet.kirikCi.length > 0) parcalar.push(`${ozet.kirikCi.length} repoda CI kırık`);
    if (ozet.bayatKararsiz > 0) parcalar.push(`${ozet.bayatKararsiz} repo karar bekliyor`);

    const { data: cihazlar } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    const hedefler = (cihazlar ?? []) as PushSubscriptionRecord[];
    const olenler: string[] = [];

    for (const hedef of hedefler) {
      const sonuc = await sendPush(hedef, {
        title: "Haftalık repo özeti",
        body: parcalar.join(" · "),
        url: "/repolar",
        tag: "repo-haftalik",
      });
      if (sonuc.ok) gonderilen++;
      else if (sonuc.expired) olenler.push(hedef.id);
    }

    if (olenler.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", olenler);
    }
  }

  return NextResponse.json({ users: kullaniciBasi.size, sent: gonderilen });
}
