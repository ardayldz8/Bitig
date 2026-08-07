import { NextResponse } from "next/server";
import { z } from "zod";
import { hashCode, hashesEqual } from "@/lib/auth/backup-codes";
import { env } from "@/lib/env";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { createAdminClient, getUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  code: z.string().trim().min(4).max(40),
});

/**
 * Kurtarma kodu ile authenticator'ı sıfırlar.
 *
 * Bu uç OTURUM AÇAMAZ: Supabase'in aal2 jetonunu yalnızca GoTrue üretebiliyor.
 * Yaptığı şey, doğrulanmış TOTP faktörünü kaldırmak. Kullanıcı bundan sonra
 * aal1'de kalır ve uygulama kurulum ekranını gösterir; yeni cihazını bağlar.
 *
 * İki faktör hâlâ korunuyor: buraya gelebilmek için şifreyle giriş yapılmış
 * (aal1 oturumu) VE geçerli bir kurtarma kodu bilinmiş olmalı.
 */
export async function POST(request: Request) {
  // Kaba kuvvete karşı dar sınır: kod 31^8 olasılıklı, dakikada 5 deneme
  // pratikte denenemez hâle getiriyor.
  const limit = checkRateLimit(clientKey(request, "recover"), 5, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla deneme. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Önce e-posta ve şifrenle giriş yapmalısın." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz kod." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 503 });
  }

  const aday = hashCode(parsed.data.code);

  const { data: rows, error } = await admin
    .from("mfa_backup_codes")
    .select("id, code_hash")
    .eq("user_id", userId)
    .is("used_at", null);

  if (error) {
    return NextResponse.json({ error: "Kod doğrulanamadı." }, { status: 502 });
  }

  // Karşılaştırma sabit zamanlı; hangi kodun yakın olduğu sızmasın
  const eslesen = (rows ?? []).find((row) =>
    typeof row.code_hash === "string" ? hashesEqual(row.code_hash, aday) : false,
  );

  if (!eslesen) {
    return NextResponse.json({ error: "Kod geçersiz ya da kullanılmış." }, { status: 403 });
  }

  // Önce tüket, sonra faktörü kaldır. Ters sırada olsaydı, faktör silindikten
  // sonra bir hata oluşursa kod hâlâ geçerli görünürdü.
  const { error: useError } = await admin
    .from("mfa_backup_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", eslesen.id)
    .is("used_at", null);

  if (useError) {
    return NextResponse.json({ error: "Kod tüketilemedi." }, { status: 502 });
  }

  // GoTrue admin API'siyle faktörleri sil. Kullanıcının kendi istemcisi
  // doğrulanmış faktörü aal1'de kaldıramıyor.
  const base = env.supabaseUrl();
  const serviceKey = env.supabaseServiceRoleKey();
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const listResponse = await fetch(`${base}/auth/v1/admin/users/${userId}/factors`, {
    headers,
  });
  if (!listResponse.ok) {
    return NextResponse.json({ error: "Faktörler okunamadı." }, { status: 502 });
  }

  const factors: unknown = await listResponse.json();
  const list = Array.isArray(factors) ? factors : [];

  let silinen = 0;
  for (const factor of list) {
    const id = (factor as { id?: unknown }).id;
    if (typeof id !== "string") continue;
    const res = await fetch(`${base}/auth/v1/admin/users/${userId}/factors/${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) silinen += 1;
  }

  if (silinen === 0) {
    return NextResponse.json(
      { error: "Authenticator kaydı kaldırılamadı." },
      { status: 502 },
    );
  }

  const { count } = await admin
    .from("mfa_backup_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);

  return NextResponse.json({
    ok: true,
    removedFactors: silinen,
    remainingCodes: count ?? 0,
  });
}
