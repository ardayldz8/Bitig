import { NextResponse } from "next/server";
import { CODE_COUNT, generateCodes, hashCode } from "@/lib/auth/backup-codes";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { createAdminClient, getUserId, readAccessToken } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Jetonun AAL seviyesi — imza zaten getUserId tarafından doğrulandı. */
function readAal(token: string): string | null {
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );
    return typeof payload === "object" && payload !== null
      ? ((payload as { aal?: unknown }).aal as string) ?? null
      : null;
  } catch {
    return null;
  }
}

/**
 * Kurtarma kodu üretir.
 *
 * aal2 ŞART: kod üretmek, TOTP'yi atlamanın yolunu oluşturmak demek. Yalnızca
 * şifreyi bilen biri (aal1) yeni kod üretip sonra onunla faktörü kaldırabilseydi
 * iki adımlı doğrulama anlamsızlaşırdı.
 *
 * Kodlar YALNIZCA burada, bir kez düz metin döner; veritabanına hash'i yazılır.
 */
export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "backup-gen"), 5, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const token = readAccessToken(request);
  const userId = await getUserId(request);
  if (!token || !userId) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
  }

  if (readAal(token) !== "aal2") {
    return NextResponse.json(
      { error: "Kurtarma kodu üretmek için önce authenticator kodunu gir." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 503 });
  }

  // Yeni set üretmek eskileri geçersiz kılar: iki ayrı liste dolaşmasın.
  const { error: clearError } = await admin
    .from("mfa_backup_codes")
    .delete()
    .eq("user_id", userId);
  if (clearError) {
    return NextResponse.json({ error: "Eski kodlar silinemedi." }, { status: 502 });
  }

  const codes = generateCodes(CODE_COUNT);
  const { error } = await admin.from("mfa_backup_codes").insert(
    codes.map((code) => ({ user_id: userId, code_hash: hashCode(code) })),
  );

  if (error) {
    return NextResponse.json({ error: "Kodlar kaydedilemedi." }, { status: 502 });
  }

  return NextResponse.json({ codes });
}

/** Kaç kullanılmamış kod kaldığını döner (kodları DEĞİL). */
export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ remaining: 0 });

  const { count, error } = await admin
    .from("mfa_backup_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);

  if (error) return NextResponse.json({ error: "Okunamadı." }, { status: 502 });
  return NextResponse.json({ remaining: count ?? 0 });
}
