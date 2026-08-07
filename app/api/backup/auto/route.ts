import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { buildBackup, countRows } from "@/lib/backup/export";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KOVA = "yedekler";
/** Kaç haftalık yedek saklanacağı. Fazlası depolamayı boşuna şişirir. */
const SAKLANACAK = 8;

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Haftalık otomatik yedek.
 *
 * Elle dışa aktarma zaten vardı ama insan unutur; kişisel takip uygulaması
 * yıllarca veri biriktiriyor ve tek bir kazara silme her şeyi götürür.
 *
 * pg_cron çağırıyor, kimlik doğrulaması hatırlatma ucuyla aynı paylaşılan
 * sır üzerinden — bu uç da bir kullanıcı oturumuyla değil veritabanından
 * tetikleniyor.
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

  const { data: users, error: userError } = await admin.auth.admin.listUsers();
  if (userError) {
    return NextResponse.json({ error: "Kullanıcılar okunamadı." }, { status: 500 });
  }

  const sonuc: { userId: string; rows: number; file: string }[] = [];
  const hatalar: { userId: string; error: string }[] = [];

  for (const user of users.users) {
    try {
      /*
       * Admin istemci RLS'i atlıyor ve buildBackup içindeki sorgular
       * user_id ile filtreleniyor — yani her kullanıcı yalnızca kendi
       * verisini alıyor, tek çağrıda hepsi karışmıyor.
       */
      const backup = await buildBackup(admin, user.id, user.email ?? null);
      const satir = countRows(backup);

      // Tarih dosya adında: kova listesi kronolojik sıralanabilsin
      const tarih = backup.exportedAt.slice(0, 10);
      const yol = `${user.id}/${tarih}.json`;

      const { error: uploadError } = await admin.storage
        .from(KOVA)
        .upload(yol, JSON.stringify(backup), {
          contentType: "application/json",
          // Aynı gün ikinci kez çalışırsa üzerine yazsın, kopya birikmesin
          upsert: true,
        });

      if (uploadError) {
        hatalar.push({ userId: user.id, error: uploadError.message });
        continue;
      }

      sonuc.push({ userId: user.id, rows: satir, file: yol });

      // Eskileri temizle
      const { data: dosyalar } = await admin.storage
        .from(KOVA)
        .list(user.id, { limit: 100, sortBy: { column: "name", order: "desc" } });

      const fazlalik = (dosyalar ?? []).slice(SAKLANACAK).map((f) => `${user.id}/${f.name}`);
      if (fazlalik.length > 0) {
        await admin.storage.from(KOVA).remove(fazlalik);
      }
    } catch (error) {
      hatalar.push({
        userId: user.id,
        error: error instanceof Error ? error.message : "bilinmeyen hata",
      });
    }
  }

  return NextResponse.json({ backups: sonuc, errors: hatalar });
}
