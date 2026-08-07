import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { createAdminClient, getUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Tarayıcının ürettiği push aboneliği.
 *
 * Anahtarlar base64url; uzunlukları sabit (p256dh 65 bayt, auth 16 bayt) ama
 * kodlamada ufak farklar olabildiği için tam uzunluk dayatılmıyor, yalnızca
 * makul bir üst sınır konuyor.
 */
const abonelikSemasi = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(10).max(100),
  }),
});

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "push-sub"), 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
  }

  const parsed = abonelikSemasi.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz abonelik." }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 503 });
  }

  /*
   * endpoint benzersiz. Aynı cihaz izni tazelediğinde yeni satır açmak yerine
   * mevcut satır güncelleniyor — yoksa her tazelemede bir kopya daha birikir
   * ve kullanıcı aynı hatırlatmayı iki kez alırdı.
   *
   * user_id de güncelleniyor: cihaz başka bir hesaba geçmişse abonelik yeni
   * sahibine taşınmalı, eski kullanıcının bildirimleri o cihaza gitmemeli.
   */
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: "Abonelik kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Kullanıcı bildirimleri kapattığında aboneliği siler. */
export async function DELETE(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
  }

  const parsed = z
    .object({ endpoint: z.string().url().max(1000) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 503 });
  }

  // user_id koşulu şart: yalnızca endpoint ile silmek, başka bir kullanıcının
  // aboneliğini silebilmek demek olurdu.
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data.endpoint)
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
