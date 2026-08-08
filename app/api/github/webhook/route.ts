import { NextResponse } from "next/server";
import { env, githubWebhookStatus } from "@/lib/env";
import {
  DELIVERY_HEADER,
  EVENT_HEADER,
  SIGNATURE_HEADER,
  verifyWebhookSignature,
} from "@/lib/github/webhook";
import { isSupportedWebhookEvent } from "@/types/github";
import { applyWebhookToInventory } from "@/lib/repos/webhook-apply";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GitHub webhook alıcısı.
 *
 * - Kullanıcı oturumu BEKLENMEZ (GitHub oturum taşımaz).
 * - İmza doğrulanmadan payload İŞLENMEZ.
 * - Aynı delivery ID ikinci kez gelirse tekrar işlenmez.
 * - Uzun süren senkronizasyon/AI işleri burada YAPILMAZ; hızlı 2xx döner.
 */
export async function POST(request: Request) {
  const status = githubWebhookStatus();
  if (!status.configured) {
    // Yapılandırılmamışsa sessizce kabul et ama İŞLEME
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  // İmza ham gövde üzerinden hesaplanır — parse edilmiş nesne imzayı bozar
  const rawBody = await request.text();

  const signature = verifyWebhookSignature(
    rawBody,
    request.headers.get(SIGNATURE_HEADER),
    env.githubWebhookSecret(),
  );
  if (!signature.ok) {
    return NextResponse.json({ error: "Webhook imzası doğrulanamadı." }, { status: 401 });
  }

  const deliveryId = request.headers.get(DELIVERY_HEADER);
  const event = request.headers.get(EVENT_HEADER);

  if (!deliveryId || !event) {
    return NextResponse.json({ error: "Eksik webhook başlığı." }, { status: 400 });
  }

  // Desteklenmeyen event: güvenli biçimde yoksay, 2xx dön
  if (!isSupportedWebhookEvent(event)) {
    return NextResponse.json({ ok: true, ignored: event });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Geçersiz gövde." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Tekrar (replay) koruması — delivery_id UNIQUE olduğu için ikinci insert hata verir
  if (admin) {
    const { error } = await admin
      .from("github_webhook_deliveries")
      .insert({ delivery_id: deliveryId, event });

    if (error) {
      // Benzersizlik ihlali = bu delivery zaten işlendi
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  /*
   * Envanter güncellenir ve gerekiyorsa bildirim gönderilir.
   *
   * Eskiden burada `projects` tablosunda eşleşen proje aranıp aktivite
   * kaydı yazılıyordu. Proje modülü kaldırıldı; artık doğrudan
   * repo_snapshots güncelleniyor — webhook'un tek işi envanteri taze
   * tutmak ve CI kırıldığında haber vermek.
   */
  if (admin) {
    await applyWebhookToInventory(admin, event, payload);
  }

  return NextResponse.json({ ok: true });
}
